import { createServer } from "../server/index";

let cachedApp: any = null;

function getApp() {
  if (!cachedApp) {
    cachedApp = createServer();
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
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
