import { Router } from "express";

import readingsRouter from "./readings.js";
import chatRouter from "./chat.js";
import shareRouter from "./share.js";
import predictionsRouter from "./predictions.js";
import subscriptionRouter from "./subscription.js";
import profileRouter from "./profile.js";
import patchRouter from "./patch.js";
import passkeyRouter from "./passkey.js";
import seedDemoDataRouter from "./seedDemoData.js";
import consentRouter from "./consent.js";
import trendsRouter from "./trends.js";

const apiRouter = Router();

apiRouter.use(
  "/readings",
  readingsRouter,
);

apiRouter.use(
  "/chat",
  chatRouter,
);

apiRouter.use(
  "/share",
  shareRouter,
);

apiRouter.use(
  "/predictions",
  predictionsRouter,
);

apiRouter.use(
  "/subscription",
  subscriptionRouter,
);

apiRouter.use(
  "/profile",
  profileRouter,
);

apiRouter.use(
  "/patch",
  patchRouter,
);

apiRouter.use(
  "/passkey",
  passkeyRouter,
);

/*
 * Predictive consent.
 *
 * Mounted separately because the canonical frontend
 * contract is:
 *
 *   /api/consent/predictive
 */
apiRouter.use(
  "/consent",
  consentRouter,
);

/*
 * Trend events.
 */
apiRouter.use(
  "/trends",
  trendsRouter,
);

/*
 * Temporary developer/test endpoint.
 *
 * Remove this route after backend testing is complete.
 */
apiRouter.use(
  "/seed-demo-data",
  seedDemoDataRouter,
);

apiRouter.get(
  "/health",
  (_req, res) => {
    return res.status(200).json({
      status: "ok",
      timestamp:
        new Date().toISOString(),
    });
  },
);

export default apiRouter;