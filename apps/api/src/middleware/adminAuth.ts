import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";

/**
 * Middleware that authenticates admin requests.
 * Expects: Authorization: Admin <ADMIN_API_SECRET>
 */
export function requireAdminAuth(req: Request, _res: Response, next: NextFunction) {
  const secret = process.env["ADMIN_API_SECRET"];
  if (!secret) {
    throw new Error("ADMIN_API_SECRET environment variable is required");
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Admin ")) {
    throw new AppError(401, "Missing or invalid admin authorization");
  }

  const provided = header.slice(6);
  if (provided !== secret) {
    throw new AppError(403, "Invalid admin secret");
  }

  next();
}
