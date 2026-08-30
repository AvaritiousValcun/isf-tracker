import { env } from "../lib/env";

export interface PaymentRequest {
  patientId: string;
  amount: number;
  currency: string;
  phoneNumber?: string;
}

export interface PaymentResponse {
  checkoutId: string;
  providerReference: string;
  redirectUrl?: string;
  status: "pending" | "completed" | "failed";
  mode: "mock" | "daraja";
  instructions: string;
}

export interface PaymentProvider {
  readonly mode: "mock" | "daraja";
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;
  verifyPayment(providerReference: string): Promise<boolean>;
}

function normalizeMsisdn(phoneNumber?: string): string | null {
  if (!phoneNumber) {
    return null;
  }

  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `254${digits}`;
  }

  return null;
}

export class MockMpesaProvider implements PaymentProvider {
  readonly mode = "mock" as const;

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const checkoutId = `mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const providerReference = `MOCK_MPESA_${Date.now()}`;

    return {
      checkoutId,
      providerReference,
      status: "pending",
      mode: "mock",
      instructions:
        "Demo payment mode is active. No M-Pesa charge is made. Use the development confirmation action to mark this pending payment complete after you have reviewed it.",
    };
  }

  async verifyPayment(_providerReference: string): Promise<boolean> {
    // Mock payments are never treated as a real Safaricom confirmation.
    return false;
  }
}

export class DarajaMpesaProvider implements PaymentProvider {
  readonly mode = "daraja" as const;

  private get baseUrl() {
    return env.MPESA_ENVIRONMENT === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";
  }

  private async getAccessToken(): Promise<string> {
    const key = env.MPESA_CONSUMER_KEY;
    const secret = env.MPESA_CONSUMER_SECRET;

    if (!key || !secret) {
      throw new Error(
        "M-Pesa Daraja credentials are not configured (MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET).",
      );
    }

    const credentials = Buffer.from(`${key}:${secret}`).toString("base64");
    const response = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Unable to authenticate with M-Pesa Daraja.");
    }

    const data = (await response.json()) as { access_token?: string };

    if (!data.access_token) {
      throw new Error("M-Pesa Daraja did not return an access token.");
    }

    return data.access_token;
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const shortcode = env.MPESA_SHORTCODE;
    const passkey = env.MPESA_PASSKEY;
    const callbackUrl = env.MPESA_CALLBACK_URL;
    const msisdn = normalizeMsisdn(request.phoneNumber);

    if (!shortcode || !passkey || !callbackUrl) {
      throw new Error(
        "M-Pesa STK Push is not fully configured. Set MPESA_SHORTCODE, MPESA_PASSKEY and MPESA_CALLBACK_URL.",
      );
    }

    if (!msisdn) {
      throw new Error(
        "A valid Kenyan mobile number is required to start M-Pesa payment.",
      );
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      "base64",
    );
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: request.amount,
          PartyA: msisdn,
          PartyB: shortcode,
          PhoneNumber: msisdn,
          CallBackURL: callbackUrl,
          AccountReference: "ISFTracker",
          TransactionDesc: "ISF Tracker Premium",
        }),
      },
    );

    const data = (await response.json()) as {
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      ResponseCode?: string;
      errorMessage?: string;
      errorCode?: string;
    };

    if (!response.ok || data.ResponseCode !== "0" || !data.CheckoutRequestID) {
      throw new Error(
        data.errorMessage ||
          "M-Pesa did not accept the payment request. Check the phone number and Daraja credentials.",
      );
    }

    return {
      checkoutId: data.CheckoutRequestID,
      providerReference: data.CheckoutRequestID,
      status: "pending",
      mode: "daraja",
      instructions:
        "Check your phone and enter your M-Pesa PIN to complete the KSh 250 payment.",
    };
  }

  async verifyPayment(providerReference: string): Promise<boolean> {
    const shortcode = env.MPESA_SHORTCODE;
    const passkey = env.MPESA_PASSKEY;

    if (!shortcode || !passkey) {
      return false;
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      "base64",
    );
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: providerReference,
        }),
      },
    );

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as {
      ResultCode?: string | number;
    };

    return String(data.ResultCode) === "0";
  }
}

export function createPaymentProvider(): PaymentProvider {
  const darajaReady =
    env.PAYMENT_MODE === "daraja" &&
    Boolean(
      env.MPESA_CONSUMER_KEY &&
        env.MPESA_CONSUMER_SECRET &&
        env.MPESA_SHORTCODE &&
        env.MPESA_PASSKEY &&
        env.MPESA_CALLBACK_URL,
    );

  if (darajaReady) {
    return new DarajaMpesaProvider();
  }

  return new MockMpesaProvider();
}
