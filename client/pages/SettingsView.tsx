import React, { useEffect, useState } from "react";
import {
  Settings,
  Shield,
  CreditCard,
  Activity,
  Globe,
  Trash2,
  Plus,
  CheckCircle,
  Smartphone,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { startRegistration } from "@simplewebauthn/browser";
import { formatCurrency, formatDate } from "../lib/formatters";
import {
  t as translate,
  type Language,
  type TranslationKey,
} from "../lib/i18n";
import { useAuth } from "../hooks/useAuth";

type ThemeMode = "light" | "dark" | "system";

type SettingsViewProps = {
  language: Language;
  setLanguage: React.Dispatch<React.SetStateAction<Language>>;
  themeMode: ThemeMode;
  setThemeMode: React.Dispatch<React.SetStateAction<ThemeMode>>;
  onOpenAccessibility: () => void;
};

type Profile = {
  id?: string;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  language?: Language;
};

type Subscription = {
  plan?: string;
  status?: string;
  expires_at?: string | null;
  renewal_at?: string | null;
};

type Patch = {
  battery_percent?: number;
  activated_at?: string | null;
  replacement_due_at?: string | null;
  wear_started_at?: string | null;
  connected?: boolean;
  status?: string;
};

type Passkey = {
  id: string;
  device_name?: string | null;
  created_at?: string | null;
  last_used_at?: string | null;
};

type Consultant = {
  id: string;
  name?: string;
  full_name?: string;
};

type RegistrationOptionsResponse = {
  challenge: string;
  rp: {
    name: string;
    id?: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    alg: number;
    type: "public-key";
  }>;
  timeout?: number;
  excludeCredentials?: Array<{
    id: string;
    type: "public-key";
    transports?: AuthenticatorTransport[];
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: AuthenticatorAttachment;
    residentKey?: ResidentKeyRequirement;
    requireResidentKey?: boolean;
    userVerification?: UserVerificationRequirement;
  };
  attestation?: AttestationConveyancePreference;
};

type TranslationMap = Record<string, string>;

const additionalTranslations: Record<Language, TranslationMap> = {
  en: {
    "settings.subtitle":
      "Manage your account, security, patch and preferences.",
    "settings.profile.title": "Patient profile",
    "settings.profile.name": "Full name",
    "settings.profile.email": "Email address",
    "settings.profile.language": "Language",
    "settings.patch.title": "Patch telemetry",
    "settings.patch.status": "Status",
    "settings.patch.connected": "Connected",
    "settings.patch.battery": "Battery",
    "settings.patch.wear_start": "Wear started",
    "settings.patch.replace_date": "Replacement date",
    "settings.subscription.title": "Subscription & billing",
    "settings.subscription.desc":
      "Manage your ISF Tracker subscription and messaging access.",
    "settings.subscription.premium_plan": "Premium",
    "settings.subscription.free_plan": "Free",
    "settings.subscription.active": "Active",
    "settings.subscription.renews": "Renews on",
    "settings.subscription.free_limits":
      "Free plan includes 50 consultant messages.",
    "settings.subscription.processing": "Processing...",
    "settings.subscription.upgrade": "Upgrade",
    "settings.subscription.month_short": "month",
    "settings.security.title": "Security",
    "settings.security.desc":
      "Manage passkeys and secure access to your account.",
    "settings.security.passkeys": "Passkeys",
    "settings.security.add_passkey": "Add passkey",
    "settings.security.no_passkeys":
      "No passkeys have been registered for this account.",
    "settings.security.registering": "Registering...",
    "settings.security.registered": "Registered",
    "settings.security.remove": "Remove",
    "settings.care_team.title": "Care team",
    "settings.care_team.desc":
      "Consultants currently associated with your account.",
    "settings.care_team.consultant": "Consultant",
    "settings.theme.title": "Theme",
    "settings.theme.desc": "Choose how ISF Tracker should appear.",
    "settings.accessibility.title": "Accessibility",
    "settings.accessibility.desc":
      "Text size, contrast and motion preferences.",
    "settings.accessibility.button": "Accessibility",
    "settings.language.select": "Select language",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.system": "System",
    "settings.patch.none": "No active patch device paired.",
    "settings.security.not_authenticated":
      "You are not authenticated. Please sign in again.",
  },

  sw: {
    "settings.subtitle":
      "Simamia akaunti yako, usalama, kibandiko na mapendeleo.",
    "settings.profile.title": "Wasifu wa mgonjwa",
    "settings.profile.name": "Jina kamili",
    "settings.profile.email": "Barua pepe",
    "settings.profile.language": "Lugha",
    "settings.patch.title": "Taarifa za kibandiko",
    "settings.patch.status": "Hali",
    "settings.patch.connected": "Imeunganishwa",
    "settings.patch.battery": "Betri",
    "settings.patch.wear_start": "Ilianza kutumika",
    "settings.patch.replace_date": "Tarehe ya kubadilisha",
    "settings.subscription.title": "Usajili na malipo",
    "settings.subscription.desc":
      "Simamia usajili wako wa ISF Tracker na ujumbe.",
    "settings.subscription.premium_plan": "Premium",
    "settings.subscription.free_plan": "Bure",
    "settings.subscription.active": "Hai",
    "settings.subscription.renews": "Inasasishwa",
    "settings.subscription.free_limits":
      "Mpango wa bure una ujumbe 50 wa mshauri.",
    "settings.subscription.processing": "Inachakatwa...",
    "settings.subscription.upgrade": "Boresha",
    "settings.subscription.month_short": "mwezi",
    "settings.security.title": "Usalama",
    "settings.security.desc":
      "Simamia passkey na ufikiaji salama wa akaunti yako.",
    "settings.security.passkeys": "Passkey",
    "settings.security.add_passkey": "Ongeza passkey",
    "settings.security.no_passkeys":
      "Hakuna passkey iliyosajiliwa kwenye akaunti hii.",
    "settings.security.registering": "Inasajili...",
    "settings.security.registered": "Imesajiliwa",
    "settings.security.remove": "Ondoa",
    "settings.care_team.title": "Timu ya afya",
    "settings.care_team.desc":
      "Washauri wanaohusishwa na akaunti yako kwa sasa.",
    "settings.care_team.consultant": "Mshauri",
    "settings.theme.title": "Mandhari",
    "settings.theme.desc": "Chagua jinsi ISF Tracker ionekane.",
    "settings.accessibility.title": "Ufikivu",
    "settings.accessibility.desc":
      "Ukubwa wa maandishi, tofauti ya rangi na mwendo.",
    "settings.accessibility.button": "Ufikivu",
    "settings.language.select": "Chagua lugha",
    "settings.theme.light": "Mwangaza",
    "settings.theme.dark": "Giza",
    "settings.theme.system": "Mfumo",
    "settings.patch.none": "Hakuna kibandiko kilichounganishwa.",
    "settings.security.not_authenticated":
      "Hujaingia kwenye akaunti. Tafadhali ingia tena.",
  },
};

function getText(language: Language, key: string): string {
  const additional = additionalTranslations[language]?.[key];

  if (additional) {
    return additional;
  }

  try {
    return translate(language, key as TranslationKey);
  } catch {
    return key;
  }
}

export default function SettingsView({
  language,
  setLanguage,
  themeMode,
  setThemeMode,
  onOpenAccessibility,
}: SettingsViewProps) {
  const { session, user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [patch, setPatch] = useState<Patch | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || "";

  const tr = (key: string) => getText(language, key);

  const getToken = (): string => {
    return session?.access_token || "";
  };

  useEffect(() => {
    void loadAllSettings();
  }, [session?.access_token, user?.id]);

  const loadAllSettings = async () => {
    const token = getToken();

    if (!token) {
      console.warn(
        "Settings API skipped: no Supabase access token."
      );
      return;
    }

    setLoadingSettings(true);

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };

    try {
      const responses = await Promise.allSettled([
        fetch(`${apiBase}/api/profile`, { headers }),
        fetch(`${apiBase}/api/subscription`, { headers }),
        fetch(`${apiBase}/api/patch`, { headers }),
        fetch(`${apiBase}/api/passkey`, { headers }),
        fetch(`${apiBase}/api/chat/consultants`, { headers }),
      ]);

      const [pRes, sRes, paRes, pkRes, cRes] = responses;

      if (pRes.status === "fulfilled" && pRes.value.ok) {
        setProfile(await pRes.value.json());
      } else if (pRes.status === "fulfilled") {
        console.error(
          "Profile request failed:",
          pRes.value.status,
          await pRes.value.text().catch(() => "")
        );
      }

      if (sRes.status === "fulfilled" && sRes.value.ok) {
        setSub(await sRes.value.json());
      } else if (sRes.status === "fulfilled") {
        console.error(
          "Subscription request failed:",
          sRes.value.status,
          await sRes.value.text().catch(() => "")
        );
      }

      if (paRes.status === "fulfilled" && paRes.value.ok) {
        setPatch(await paRes.value.json());
      } else if (paRes.status === "fulfilled") {
        console.error(
          "Patch request failed:",
          paRes.value.status,
          await paRes.value.text().catch(() => "")
        );
      }

      if (pkRes.status === "fulfilled" && pkRes.value.ok) {
        const passkeyData = await pkRes.value.json();

        setPasskeys(
          Array.isArray(passkeyData)
            ? passkeyData
            : Array.isArray(passkeyData?.passkeys)
              ? passkeyData.passkeys
              : []
        );
      } else if (pkRes.status === "fulfilled") {
        console.error(
          "Passkey request failed:",
          pkRes.value.status,
          await pkRes.value.text().catch(() => "")
        );
      }

      if (cRes.status === "fulfilled" && cRes.value.ok) {
        const consultantData = await cRes.value.json();

        setConsultants(
          Array.isArray(consultantData)
            ? consultantData
            : Array.isArray(consultantData?.consultants)
              ? consultantData.consultants
              : []
        );
      } else if (cRes.status === "fulfilled") {
        console.error(
          "Consultants request failed:",
          cRes.value.status,
          await cRes.value.text().catch(() => "")
        );
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    if (lang !== "en" && lang !== "sw") {
      return;
    }

    const nextLanguage = lang as Language;

    setLanguage(nextLanguage);

    const token = getToken();

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${apiBase}/api/profile/language`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            language: nextLanguage,
          }),
        }
      );

      if (!response.ok) {
        console.error(
          "Failed to save language:",
          response.status,
          await response.text().catch(() => "")
        );
      }
    } catch (error) {
      console.error("Failed to save language:", error);
    }
  };

  const handleThemeChange = (theme: string) => {
    if (
      theme === "light" ||
      theme === "dark" ||
      theme === "system"
    ) {
      setThemeMode(theme);
    }
  };

  const handleUpgrade = async () => {
    const token = getToken();

    if (!token) {
      alert(
        tr("settings.security.not_authenticated")
      );
      return;
    }

    setLoadingPayment(true);

    try {
      const res = await fetch(
        `${apiBase}/api/subscription/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            phoneNumber: "+254712345678",
          }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Unable to initiate payment."
        );
      }

      alert(
        `M-Pesa STK Push initiated (${
          data?.checkoutId || "pending"
        }).`
      );

      await loadAllSettings();
    } catch (error) {
      console.error("Upgrade failed:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to process upgrade."
      );
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleAddPasskey = async () => {
    if (addingPasskey) {
      return;
    }

    const token = getToken();

    if (!token) {
      alert(
        tr("settings.security.not_authenticated")
      );
      return;
    }

    setAddingPasskey(true);

    try {
      const optRes = await fetch(
        `${apiBase}/api/passkey/register/options`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const optionsData =
        await optRes.json().catch(() => null);

      if (!optRes.ok) {
        throw new Error(
          optionsData?.error ||
            "Unable to start passkey registration."
        );
      }

      const options =
        optionsData as RegistrationOptionsResponse;

      const attResp =
        await startRegistration({
          optionsJSON: options,
        });

      const verifyRes = await fetch(
        `${apiBase}/api/passkey/register/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(attResp),
        }
      );

      const verifyData =
        await verifyRes.json().catch(() => null);

      if (!verifyRes.ok) {
        throw new Error(
          verifyData?.error ||
            "Unable to verify passkey registration."
        );
      }

      await loadAllSettings();
    } catch (error) {
      console.error(
        "Passkey registration failed:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to add passkey."
      );
    } finally {
      setAddingPasskey(false);
    }
  };

  const handleRemovePasskey = async (
    id: string
  ) => {
    const token = getToken();

    if (!token) {
      alert(
        tr("settings.security.not_authenticated")
      );
      return;
    }

    try {
      const response = await fetch(
        `${apiBase}/api/passkey/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data =
          await response.json().catch(() => null);

        throw new Error(
          data?.error ||
            "Unable to remove passkey."
        );
      }

      await loadAllSettings();
    } catch (error) {
      console.error(
        "Failed to remove passkey:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to remove passkey."
      );
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="w-8 h-8 text-primary" />
          {tr("settings.title")}
        </h1>

        <p className="text-muted-foreground">
          {tr("settings.subtitle")}
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>
            {tr("settings.profile.title")}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {tr("settings.profile.name")}
              </label>

              <div className="text-foreground font-semibold text-lg">
                {profile?.full_name || "--"}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {tr("settings.profile.email")}
              </label>

              <div className="text-foreground font-semibold text-lg">
                {profile?.email ||
                  user?.email ||
                  "--"}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />

              <span className="text-sm font-medium">
                {tr("settings.profile.language")}
              </span>
            </div>

            <Select
              value={language}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue
                  placeholder={tr(
                    "settings.language.select"
                  )}
                />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="en">
                  English
                </SelectItem>

                <SelectItem value="sw">
                  Kiswahili
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 flex items-center justify-between border-t">
            <div>
              <span className="text-sm font-medium">
                {tr("settings.theme.title")}
              </span>

              <p className="text-xs text-muted-foreground">
                {tr("settings.theme.desc")}
              </p>
            </div>

            <Select
              value={themeMode}
              onValueChange={handleThemeChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="light">
                  {tr("settings.theme.light")}
                </SelectItem>

                <SelectItem value="dark">
                  {tr("settings.theme.dark")}
                </SelectItem>

                <SelectItem value="system">
                  {tr("settings.theme.system")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 flex items-center justify-between border-t">
            <div>
              <span className="text-sm font-medium">
                {tr(
                  "settings.accessibility.title"
                )}
              </span>

              <p className="text-xs text-muted-foreground">
                {tr(
                  "settings.accessibility.desc"
                )}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAccessibility}
            >
              {tr(
                "settings.accessibility.button"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            {tr("settings.patch.title")}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {patch ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">
                  {tr("settings.patch.status")}
                </span>

                <div className="flex items-center gap-1.5 mt-1 font-medium text-emerald-600">
                  <CheckCircle className="w-4 h-4" />

                  {patch.connected === false
                    ? "Disconnected"
                    : tr(
                        "settings.patch.connected"
                      )}
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground">
                  {tr("settings.patch.battery")}
                </span>

                <div className="font-medium text-foreground mt-1">
                  {patch.battery_percent ?? "--"}
                  {patch.battery_percent != null
                    ? "%"
                    : ""}
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground">
                  {tr(
                    "settings.patch.wear_start"
                  )}
                </span>

                <div className="font-medium text-foreground mt-1">
                  {patch.wear_started_at ||
                  patch.activated_at
                    ? formatDate(
                        patch.wear_started_at ||
                          patch.activated_at ||
                          ""
                      )
                    : "--"}
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground">
                  {tr(
                    "settings.patch.replace_date"
                  )}
                </span>

                <div className="font-medium text-foreground mt-1">
                  {patch.replacement_due_at
                    ? formatDate(
                        patch.replacement_due_at
                      )
                    : "--"}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tr("settings.patch.none")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {tr("settings.subscription.title")}
          </CardTitle>

          <CardDescription>
            {tr("settings.subscription.desc")}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold capitalize text-foreground">
                {sub?.plan === "premium"
                  ? tr(
                      "settings.subscription.premium_plan"
                    )
                  : tr(
                      "settings.subscription.free_plan"
                    )}
              </span>

              <Badge className="bg-emerald-600">
                {sub?.status
                  ? sub.status
                  : tr(
                      "settings.subscription.active"
                    )}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {sub?.plan === "premium"
                ? `${tr(
                    "settings.subscription.renews"
                  )} ${
                    sub.expires_at ||
                    sub.renewal_at
                      ? formatDate(
                          sub.expires_at ||
                            sub.renewal_at ||
                            ""
                        )
                      : "--"
                  }`
                : tr(
                    "settings.subscription.free_limits"
                  )}
            </p>
          </div>

          {sub?.plan !== "premium" && (
            <Button
              onClick={handleUpgrade}
              disabled={loadingPayment}
              className="gap-2"
            >
              {loadingPayment
                ? tr(
                    "settings.subscription.processing"
                  )
                : `${tr(
                    "settings.subscription.upgrade"
                  )} (${formatCurrency(
                    250
                  )} ${tr(
                    "settings.subscription.month_short"
                  )})`}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {tr("settings.security.title")}
          </CardTitle>

          <CardDescription>
            {tr("settings.security.desc")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">
              {tr("settings.security.passkeys")}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddPasskey}
              disabled={addingPasskey}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />

              {addingPasskey
                ? tr(
                    "settings.security.registering"
                  )
                : tr(
                    "settings.security.add_passkey"
                  )}
            </Button>
          </div>

          {passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {tr(
                "settings.security.no_passkeys"
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex justify-between items-center p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />

                    <div>
                      <div className="text-sm font-medium">
                        {pk.device_name ||
                          "Biometric Authenticator"}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {tr(
                          "settings.security.registered"
                        )}
                        :{" "}
                        {pk.created_at
                          ? formatDate(
                              pk.created_at
                            )
                          : "--"}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleRemovePasskey(
                        pk.id
                      )
                    }
                    className="text-destructive hover:bg-destructive/10"
                    aria-label={tr(
                      "settings.security.remove"
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {consultants.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>
              {tr("settings.care_team.title")}
            </CardTitle>

            <CardDescription>
              {tr("settings.care_team.desc")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            {consultants.map((consultant) => (
              <div
                key={consultant.id}
                className="rounded-lg border p-3"
              >
                <p className="font-medium">
                  {consultant.full_name ||
                    consultant.name ||
                    tr(
                      "settings.care_team.consultant"
                    )}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loadingSettings && (
        <p className="text-xs text-muted-foreground text-center">
          Loading settings...
        </p>
      )}
    </div>
  );
}