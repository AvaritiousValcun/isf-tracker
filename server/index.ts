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

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  app.use(
    express.json({
      limit: "1mb",
    }),
  );

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api", apiLimiter);
  app.use("/api", apiRouter);
  app.use(errorHandler);

  return app;
}

async function recoverTrendProcessing() {
  try {
    const result = await TrendProcessingService.processPending(25);
    console.log("[ISF Tracker] Trend processing recovery completed.", result);
  } catch (error) {
    console.error("[ISF Tracker] Trend processing recovery failed:", error);
  }
}

function startTrendProcessingWorker() {
  void recoverTrendProcessing();

  const interval = setInterval(() => {
    void recoverTrendProcessing();
  }, 60 * 1000);

  interval.unref();
}

const isDirectExecution =
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname;

if (isDirectExecution && process.env.NODE_ENV !== "test") {
  const app = createServer();
  const port = Number(env.PORT || 3000);

  app.listen(port, () => {
    console.log(`[ISF Tracker Server] Running on port ${port} in ${env.NODE_ENV} mode`);
    console.log(`[ISF Tracker Server] API: http://localhost:${port}/api`);
    console.log(`[ISF Tracker Server] Health: http://localhost:${port}/api/health`);

    startTrendProcessingWorker();
  });
}