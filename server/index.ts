import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { env } from "./lib/env.js";
import apiRouter from "./routes/api.js";
import { errorHandler } from "./middleware/error.js";
import { TrendProcessingService } from "./services/trendProcessingService.js";

export function createServer() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

  app.use("/api", apiLimiter);
  app.use("/api", apiRouter);
  app.use(errorHandler);

  return app;
}
