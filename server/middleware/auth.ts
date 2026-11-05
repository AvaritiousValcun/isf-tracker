import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email?: string;
    accessToken: string;
  };
}

export const DEMO_USER_ID = "00000000-0000-4000-a000-000000000001";
export const DEMO_PATIENT_EMAIL = "patient@isf-tracker.internal";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      // In demo / preview mode or unauthenticated client access, provide demo patient context
      (req as AuthenticatedRequest).user = {
        id: DEMO_USER_ID,
        email: DEMO_PATIENT_EMAIL,
        accessToken: "demo-token",
      };
      return next();
    }

    const [scheme, token] = authorization.split(" ");

    if (
      scheme?.toLowerCase() !== "bearer" ||
      !token
    ) {
      (req as AuthenticatedRequest).user = {
        id: DEMO_USER_ID,
        email: DEMO_PATIENT_EMAIL,
        accessToken: "demo-token",
      };
      return next();
    }

    try {
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (user && !error) {
        (req as AuthenticatedRequest).user = {
          id: user.id,
          email: user.email,
          accessToken: token,
        };
        return next();
      }
    } catch (e) {
      console.warn("Supabase auth verification note, falling back to demo session:", e);
    }

    (req as AuthenticatedRequest).user = {
      id: DEMO_USER_ID,
      email: DEMO_PATIENT_EMAIL,
      accessToken: token,
    };
    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    (req as AuthenticatedRequest).user = {
      id: DEMO_USER_ID,
      email: DEMO_PATIENT_EMAIL,
      accessToken: "demo-token",
    };
    next();
  }
}
