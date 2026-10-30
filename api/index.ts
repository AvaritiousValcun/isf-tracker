import { createServer } from "../server/index";

let cachedApp: any = null;

function getApp() {
  if (!cachedApp) {
    cachedApp = createServer();
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  // Ultra-fast and 100% reliable health check endpoint
  if (req.url === "/api/health" || req.url === "/health") {
    return res.status(200).json({
      status: "ok",
      environment: process.env.NODE_ENV || "production",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const app = getApp();
    return app(req, res);
  } catch (err: any) {
    console.error("[Vercel API Invocation Error]", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
}
