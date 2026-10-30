let cachedApp: any = null;

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) {
      const { createServer } = await import("../server/index");
      cachedApp = createServer();
    }
    return cachedApp(req, res);
  } catch (err: any) {
    console.error("[Vercel Serverless Invocation Error]:", err);
    return res.status(500).json({
      error: "Serverless function initialization error",
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
}
