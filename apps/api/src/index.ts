import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import * as Sentry from "@sentry/node";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { verifyRouter } from "./routes/verify.js";
import { billingRouter } from "./routes/billing.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./services/logger.js";

function getAllowedOrigins(): string[] {
  const raw = process.env["FRONTEND_URL"];
  const origins = (raw ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .map((s) => s.replace(/\/+$/, ""))
    .filter(Boolean);

  if (process.env["NODE_ENV"] === "production") {
    if (!raw) {
      throw new Error("FRONTEND_URL is required in production");
    }

    for (const origin of origins) {
      if (origin.includes("localhost")) {
        throw new Error(`Invalid FRONTEND_URL for production: ${origin}`);
      }
    }
  }

  return origins;
}

function validateRequiredEnv() {
  const required = [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "BOT_API_SECRET",
    "DISCORD_BOT_TOKEN",
    "MEGAETH_RPC_URL",
  ];

  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const isProduction = process.env["NODE_ENV"] === "production";

  if (isProduction) {
    // Enforce minimum secret length
    const secrets = ["JWT_SECRET", "JWT_REFRESH_SECRET", "BOT_API_SECRET"] as const;
    for (const name of secrets) {
      const value = process.env[name]!;
      if (value.length < 32) {
        throw new Error(
          `${name} is too short (${value.length} chars). Use at least 32 random characters in production.`,
        );
      }
      // Detect placeholder values
      if (/^(change_this|your_|test|secret|password)/i.test(value)) {
        throw new Error(
          `${name} appears to be a placeholder value. Set a strong random secret for production.`,
        );
      }
    }

    // Ensure Stripe is in live mode
    const stripeKey = process.env["STRIPE_SECRET_KEY"];
    if (stripeKey && stripeKey.startsWith("sk_test_")) {
      logger.warn("STRIPE_SECRET_KEY is using a TEST key in production! Switch to a live key before accepting real payments.");
    }

    // Warn about missing monitoring
    if (!process.env["SENTRY_DSN"]) {
      logger.warn("SENTRY_DSN is not set. Error monitoring is disabled in production.");
    }
  }
}

if (process.env["SENTRY_DSN"]) {
  Sentry.init({
    dsn: process.env["SENTRY_DSN"],
    environment: process.env["NODE_ENV"] ?? "development",
  });
}

validateRequiredEnv();

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = getAllowedOrigins();

app.use(pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers["x-correlation-id"];
    const correlationId = typeof incoming === "string" && incoming.length > 0
      ? incoming
      : crypto.randomUUID();

    res.setHeader("x-correlation-id", correlationId);
    return correlationId;
  },
}));

app.use(helmet());

// HTTPS redirect in production (Railway / reverse proxies set x-forwarded-proto)
if (process.env["NODE_ENV"] === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] === "http") {
      res.redirect(301, `https://${req.headers.host}${req.url}`);
      return;
    }
    next();
  });
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalized = origin.replace(/\/+$/, "");
    if (allowedOrigins.includes(normalized)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
}));

// Webhooks must read raw request body for signature validation.
app.use("/api/v1/webhooks", webhooksRouter);

app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  const checks: Record<string, string> = { api: "ok" };
  let healthy = true;

  // Check Redis
  try {
    const { getRedis } = await import("./services/redis.js");
    const redis = getRedis();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
    healthy = false;
  }

  // Check Postgres
  try {
    const { getDb } = await import("@megaeth-verify/db");
    const db = getDb();
    await db.execute(/* sql */ `SELECT 1`);
    checks.postgres = "ok";
  } catch {
    checks.postgres = "error";
    healthy = false;
  }

  const status = healthy ? 200 : 503;
  res.status(status).json({
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/projects", projectsRouter);
app.use("/api/v1/verify", verifyRouter);
app.use("/api/v1/billing", billingRouter);

app.use(errorHandler);

const port = parseInt(process.env["API_PORT"] ?? "3001", 10);

const server = app.listen(port, () => {
  logger.info({ port }, `API server running on http://localhost:${port}`);
});

async function shutdown() {
  logger.info("Shutting down API server...");
  server.close();

  const { closePool } = await import("@megaeth-verify/db");
  const { closeRedis } = await import("./services/redis.js");
  await Promise.all([closePool(), closeRedis()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
