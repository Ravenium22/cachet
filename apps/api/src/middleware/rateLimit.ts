import type { Request, Response, NextFunction } from "express";
import { getRedis } from "../services/redis.js";
import {
  REDIS_PREFIX,
  RATE_LIMIT_RULES,
  TIER_RATE_LIMITS,
  VERIFICATION_NONCE_TTL_SECONDS,
} from "@megaeth-verify/shared";
import { getDb, projects, and, eq, isNull } from "@megaeth-verify/db";
import { AppError } from "./errorHandler.js";
import { getEffectiveSubscription } from "../services/subscription.js";
import { logger } from "../services/logger.js";

interface RateLimitOptions {
  scope: string;
  windowSeconds: number;
  maxRequests: number | ((req: Request) => Promise<number> | number);
  keyGenerator: (req: Request) => string | null;
  onLimitExceeded?: (req: Request) => Promise<void> | void;
}

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local nowMs = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local member = ARGV[4]
local minScore = nowMs - windowMs

redis.call('ZREMRANGEBYSCORE', key, 0, minScore)
local current = redis.call('ZCARD', key)

if current >= maxRequests then
  local ttl = redis.call('PTTL', key)
  if ttl < 0 then ttl = windowMs end
  return {0, current, ttl}
end

redis.call('ZADD', key, nowMs, member)
redis.call('PEXPIRE', key, windowMs)
local updated = redis.call('ZCARD', key)
return {1, updated, windowMs}
`;

export function slidingWindowRateLimit(options: RateLimitOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = options.keyGenerator(req);
      if (!identifier) {
        next();
        return;
      }

      const maxRequests = typeof options.maxRequests === "function"
        ? await options.maxRequests(req)
        : options.maxRequests;

      const key = `${REDIS_PREFIX.RATE_LIMIT}${options.scope}:${identifier}`;
      const nowMs = Date.now();
      const windowMs = options.windowSeconds * 1000;
      const nonce = `${nowMs}:${Math.random().toString(16).slice(2)}`;

      const redis = getRedis();
      const result = await redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        key,
        nowMs.toString(),
        windowMs.toString(),
        maxRequests.toString(),
        nonce,
      ) as [number | string, number | string, number | string];

      const allowed = Number(result[0]) === 1;
      const retryAfterMs = Number(result[2]);

      if (!allowed) {
        if (options.onLimitExceeded) {
          await options.onLimitExceeded(req);
        }

        throw new AppError(429, "Too many requests. Please try again later.", {
          code: "rate_limited",
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        });
      }

      next();
    } catch (err) {
      if (
        err instanceof Error &&
        /(redis|ecconn|econn|read.?only|timeout|connection)/i.test(err.message)
      ) {
        logger.warn({ err, scope: options.scope }, "Rate limit check failed; allowing request");
        next();
        return;
      }
      next(err);
    }
  };
}

export const authenticatedApiRateLimit = () => slidingWindowRateLimit({
  scope: "auth-api",
  windowSeconds: RATE_LIMIT_RULES.authenticatedApi.windowSeconds,
  maxRequests: RATE_LIMIT_RULES.authenticatedApi.requests,
  keyGenerator: (req) => req.user?.sub ?? null,
});

export const publicApiRateLimit = () => slidingWindowRateLimit({
  scope: "public-api",
  windowSeconds: RATE_LIMIT_RULES.publicApi.windowSeconds,
  maxRequests: RATE_LIMIT_RULES.publicApi.requests,
  keyGenerator: (req) => req.ip ?? null,
});

export const verificationInitiationRateLimit = () => slidingWindowRateLimit({
  scope: "verify-initiate",
  windowSeconds: RATE_LIMIT_RULES.verificationInitiation.windowSeconds,
  maxRequests: async (req) => {
    const guildId = typeof req.body?.guildId === "string" ? req.body.guildId : null;
    if (!guildId) {
      return RATE_LIMIT_RULES.verificationInitiation.requests;
    }

    const db = getDb();
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.discordGuildId, guildId),
        isNull(projects.deletedAt),
      ),
      columns: { id: true },
    });

    if (!project) {
      return RATE_LIMIT_RULES.verificationInitiation.requests;
    }

    const { effectiveTier } = await getEffectiveSubscription(project.id);
    return TIER_RATE_LIMITS[effectiveTier].verificationInitiationRequests;
  },
  keyGenerator: (req) => {
    const guildId = typeof req.body?.guildId === "string" ? req.body.guildId : null;
    const userDiscordId = typeof req.body?.userDiscordId === "string" ? req.body.userDiscordId : null;

    if (!guildId || !userDiscordId) {
      return null;
    }

    return `${guildId}:${userDiscordId}`;
  },
});

export const verificationCompletionRateLimit = () => slidingWindowRateLimit({
  scope: "verify-complete",
  windowSeconds: RATE_LIMIT_RULES.verificationCompletion.windowSeconds,
  maxRequests: RATE_LIMIT_RULES.verificationCompletion.requests,
  keyGenerator: (req) => {
    const token = req.params["token"];
    return typeof token === "string" ? token : null;
  },
  onLimitExceeded: async (req) => {
    const token = req.params["token"];
    if (typeof token !== "string") {
      return;
    }

    const redis = getRedis();
    await redis.del(`${REDIS_PREFIX.VERIFICATION_NONCE}${token}`);
  },
});

export async function seedVerificationCompletionWindow(token: string): Promise<void> {
  const redis = getRedis();
  const key = `${REDIS_PREFIX.RATE_LIMIT}verify-complete:${token}`;
  await redis.pexpire(key, VERIFICATION_NONCE_TTL_SECONDS * 1000);
}

export const authCallbackIpRateLimit = () => slidingWindowRateLimit({
  scope: "auth-callback-ip",
  windowSeconds: RATE_LIMIT_RULES.authCallback.windowSeconds,
  maxRequests: RATE_LIMIT_RULES.authCallback.requests,
  keyGenerator: (req) => req.ip ?? null,
});

export const authRefreshIpRateLimit = () => slidingWindowRateLimit({
  scope: "auth-refresh-ip",
  windowSeconds: RATE_LIMIT_RULES.authRefresh.windowSeconds,
  maxRequests: RATE_LIMIT_RULES.authRefresh.requests,
  keyGenerator: (req) => req.ip ?? null,
});

