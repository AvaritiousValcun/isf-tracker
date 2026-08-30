import { Request, Response } from 'express';

let app: any;
let bootError: any = null;

try {
  const { createServer } = require('../server/index.js');
  app = createServer();
} catch (err) {
  bootError = err;
}

export default function handler(req: Request, res: Response) {
  if (bootError) {
    return res.status(500).json({ error: "Boot Error", message: bootError.message, stack: bootError.stack });
  }
  return app(req, res);
}
