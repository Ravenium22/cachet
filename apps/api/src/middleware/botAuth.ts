import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";

/**
 * Middleware that authenticates requests from the Discord bot process.
 * Expects: Authorization: Bot <BOT_API_SECRET>
 */
export function requireBotAuth(req: Request, _res: Response, next: NextFunction) {
  const secret = process.env["BOT_API_SECRET"];
  if (!secret) {
    throw new Error("BOT_API_SECRET environment variable is required");
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bot ")) {
    throw new AppError(401, "Missing or invalid bot authorization");
  }

  const provided = header.slice(4);
  if (provided !== secret) {
    throw new AppError(403, "Invalid bot secret");
  }

  next();
}
