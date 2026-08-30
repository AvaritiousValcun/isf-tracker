import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  try {
    const { createServer } = await import('../server/index.js');
    const app = createServer();
    return app(req, res);
  } catch (err: any) {
    res.status(500).json({ 
      error: "Vercel Boot Error",
      message: err.message, 
      stack: err.stack,
      name: err.name 
    });
  }
}
