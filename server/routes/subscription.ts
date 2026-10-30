import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { SubscriptionService } from "../services/subscriptionService";

const router = Router();

router.get(
  "/",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const subscription = await SubscriptionService.getSubscription(
        req.user.id,
      );

      return res.json(subscription);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/checkout",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const phoneNumber =
        req.body?.phoneNumber ||
        req.body?.phone_number;

      const payment =
        await SubscriptionService.createCheckout(
          req.user.id,
          phoneNumber,
        );

      return res.status(201).json({
        success: true,
        ...payment,
      });
    } catch (error: any) {
      console.error(
        "[Subscription] Checkout error:",
        error,
      );

      return res.status(400).json({
        success: false,
        error:
          error?.message ||
          "Unable to initiate subscription payment.",
      });
    }
  },
);

router.post(
  "/webhook",
  async (req, res, next) => {
    try {
      const {
        providerReference,
        status,
      } = req.body;

      if (
        !providerReference ||
        !["completed", "failed"].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "providerReference and valid status are required.",
        });
      }

      const result =
        await SubscriptionService.handleWebhook(
          providerReference,
          status,
        );

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;