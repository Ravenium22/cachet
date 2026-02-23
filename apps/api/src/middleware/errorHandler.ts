import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import * as Sentry from "@sentry/node";
import { logger } from "../services/logger.js";
import { PaddleCheckoutError } from "../services/paddle.js";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const correlationId = (req as Request & { id?: string }).id;

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: "Validation error",
      details: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
      correlationId,
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn({
      correlationId,
      statusCode: err.statusCode,
      error: err.message,
      details: err.details,
    }, "Handled application error");

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
      correlationId,
    });
    return;
  }

  if (err instanceof PaddleCheckoutError) {
    logger.error({
      correlationId,
      paddleCode: err.code,
      detail: err.detail,
    }, "Paddle checkout error");

    if (process.env["SENTRY_DSN"]) {
      Sentry.captureException(err, {
        tags: { correlationId: correlationId ?? "unknown", kind: "paddle_checkout" },
      });
    }

    res.status(502).json({
      success: false,
      error: "Payment provider error",
      detail: err.detail,
      code: err.code,
      correlationId,
    });
    return;
  }

  // Infrastructure/transient dependency failures
  const transientMessage = err.message ?? "";
  if (/(ECONNREFUSED|ECONNRESET|ETIMEDOUT|redis|fetch failed|socket hang up)/i.test(transientMessage)) {
    logger.error({ correlationId, err }, "Transient dependency failure");
    if (process.env["SENTRY_DSN"]) {
      Sentry.captureException(err, {
        tags: { correlationId: correlationId ?? "unknown", kind: "transient_dependency" },
      });
    }

    res.status(503).json({
      success: false,
      error: "Service temporarily unavailable",
      correlationId,
    });
    return;
  }

  logger.error({ correlationId, err }, "Unhandled error");
  if (process.env["SENTRY_DSN"]) {
    Sentry.captureException(err, {
      tags: { correlationId: correlationId ?? "unknown" },
    });
  }

  res.status(500).json({
    success: false,
    error: "Internal server error",
    correlationId,
  });
}
