import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export interface AuthenticatedRequest extends Request {
user: {
id: string;
email?: string;
accessToken: string;
};
}

export async function requireAuth(
req: Request,
res: Response,
next: NextFunction,
) {
try {
const authorization = req.headers.authorization;

if (!authorization) {
  return res.status(401).json({
    error: "Authentication required.",
  });
}

const [scheme, token] = authorization.split(" ");

if (
  scheme?.toLowerCase() !== "bearer" ||
  !token
) {
  return res.status(401).json({
    error: "Invalid authentication token.",
  });
}

const {
  data: { user },
  error,
} = await supabaseAdmin.auth.getUser(token);

if (error || !user) {
  return res.status(401).json({
    error: "Invalid or expired authentication token.",
  });
}

(req as AuthenticatedRequest).user = {
  id: user.id,
  email: user.email,
  accessToken: token,
};

next();

} catch (error) {
console.error("Authentication middleware error:", error);

return res.status(500).json({
  error: "Authentication service unavailable.",
});

}
}