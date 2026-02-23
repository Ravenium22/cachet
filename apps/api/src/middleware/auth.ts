import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtAccessPayload } from "@megaeth-verify/shared";
import { AppError } from "./errorHandler.js";

// Extend Express Request to include user payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtAccessPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return secret;
}

/**
 * Middleware that requires a valid JWT access token in the Authorization header.
 * Sets req.user with the decoded payload on success.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "Missing or invalid authorization header");
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtAccessPayload;

    if (payload.type !== "access") {
      throw new AppError(401, "Invalid token type");
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, "Invalid or expired access token");
  }
}
