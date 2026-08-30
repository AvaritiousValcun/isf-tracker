import { Router } from "express";

import readingsRouter from "./readings";
import chatRouter from "./chat";
import shareRouter from "./share";
import predictionsRouter from "./predictions";
import subscriptionRouter from "./subscription";
import profileRouter from "./profile";
import patchRouter from "./patch";
import passkeyRouter from "./passkey";
import seedDemoDataRouter from "./seedDemoData";
import consentRouter from "./consent";
import trendsRouter from "./trends";

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