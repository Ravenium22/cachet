import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import {
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY,
  JWT_REFRESH_EXPIRY_SECONDS,
  REDIS_PREFIX,
  type JwtAccessPayload,
  type JwtRefreshPayload,
  type AuthTokens,
} from "@megaeth-verify/shared";
import { getRedis } from "./redis.js";

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
}

function getJwtRefreshSecret(): string {
  const secret = process.env["JWT_REFRESH_SECRET"];
  if (!secret) throw new Error("JWT_REFRESH_SECRET is required");
  return secret;
}

/**
 * Generate an access + refresh token pair for a Discord user.
 * The refresh token ID is stored in Redis for revocation.
 */
export async function generateTokens(
  discordId: string,
  username: string,
): Promise<AuthTokens> {
  const jti = crypto.randomUUID();

  const accessPayload: Omit<JwtAccessPayload, "iat" | "exp"> = {
    sub: discordId,
    username,
    type: "access",
  };

  const refreshPayload: Omit<JwtRefreshPayload, "iat" | "exp"> = {
    sub: discordId,
    jti,
    type: "refresh",
  };

  const accessToken = jwt.sign(accessPayload, getJwtSecret(), {
    expiresIn: JWT_ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign(refreshPayload, getJwtRefreshSecret(), {
    expiresIn: JWT_REFRESH_EXPIRY,
  });

  // Store refresh token ID in Redis for revocation lookup
  const redis = getRedis();
  await Promise.all([
    redis.set(
      `${REDIS_PREFIX.REFRESH_TOKEN}${jti}`,
      discordId,
      "EX",
      JWT_REFRESH_EXPIRY_SECONDS,
    ),
    redis.set(
      `user:${discordId}:username`,
      username,
      "EX",
      JWT_REFRESH_EXPIRY_SECONDS,
    ),
  ]);

  return { accessToken, refreshToken };
}

/**
 * Verify and decode a refresh token, checking it hasn't been revoked.
 * Returns the payload if valid.
 */
export async function verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
  const payload = jwt.verify(token, getJwtRefreshSecret()) as JwtRefreshPayload;

  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }

  const redis = getRedis();
  const stored = await redis.get(`${REDIS_PREFIX.REFRESH_TOKEN}${payload.jti}`);

  if (!stored) {
    throw new Error("Refresh token has been revoked");
  }

  return payload;
}

/**
 * Atomically consume (one-time use) a refresh token.
 * Prevents refresh-token replay on concurrent requests.
 */
export async function consumeRefreshToken(token: string): Promise<JwtRefreshPayload> {
  const payload = jwt.verify(token, getJwtRefreshSecret()) as JwtRefreshPayload;

  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }

  const redis = getRedis();
  const key = `${REDIS_PREFIX.REFRESH_TOKEN}${payload.jti}`;
  const consumed = await redis.eval(
    `local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;`,
    1,
    key,
  ) as string | null;

  if (!consumed) {
    throw new Error("Refresh token has been revoked");
  }

  return payload;
}

/**
 * Revoke a refresh token by deleting it from Redis.
 */
export async function revokeRefreshToken(jti: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${REDIS_PREFIX.REFRESH_TOKEN}${jti}`);
}
