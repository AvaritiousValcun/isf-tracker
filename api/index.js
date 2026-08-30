export default async function handler(req, res) {
  try {
    const { createServer } = await import('../server/index.js');
    const app = createServer();
    return app(req, res);
  } catch (err) {
    return res.status(500).json({ error: "Boot Error Caught via JS", message: err.message, stack: err.stack });
  }
}
