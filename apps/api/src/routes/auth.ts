import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { OAUTH_STATE_TTL_SECONDS, REDIS_PREFIX } from "@megaeth-verify/shared";
import { getOAuthUrl, exchangeCode, getDiscordUser } from "../services/discord.js";
import {
  generateTokens,
  verifyRefreshToken,
  revokeRefreshToken,
  consumeRefreshToken,
} from "../services/jwt.js";
import { getRedis } from "../services/redis.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { authenticatedApiRateLimit, publicApiRateLimit, authCallbackIpRateLimit, authRefreshIpRateLimit } from "../middleware/rateLimit.js";

export const authRouter = Router();

authRouter.use(publicApiRateLimit());

// ── GET /auth/discord ──────────────────────────────────────────────────────
// Redirects to Discord OAuth2 authorize URL.
authRouter.get("/discord", async (_req, res, next) => {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    const url = getOAuthUrl(state);
    const redis = getRedis();
    await redis.set(
      `${REDIS_PREFIX.OAUTH_STATE}${state}`,
      "1",
      "EX",
      OAUTH_STATE_TTL_SECONDS,
    );
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

// ── GET /auth/discord/callback ─────────────────────────────────────────────
// Handles the OAuth callback, exchanges code for tokens, returns JWT pair.
authRouter.get("/discord/callback", authCallbackIpRateLimit(), async (req, res, next) => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      state: z.string().min(1),
    });

    const { code, state } = schema.parse(req.query);

    // One-time state validation to reduce OAuth CSRF/replay risk.
    const redis = getRedis();
    const stateKey = `${REDIS_PREFIX.OAUTH_STATE}${state}`;
    const stateValid = await redis.eval(
      `local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;`,
      1,
      stateKey,
    ) as string | null;

    if (!stateValid) {
      throw new AppError(400, "Invalid or expired OAuth state");
    }

    // Exchange authorization code for Discord tokens
    const discordTokens = await exchangeCode(code);

    // Fetch user profile
    const discordUser = await getDiscordUser(discordTokens.access_token);

    // Generate our JWT pair
    const tokens = await generateTokens(discordUser.id, discordUser.username);

    // Redirect to frontend with tokens
    // Assumption: Frontend handles token storage (localStorage or httpOnly cookies).
    const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
    const params = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    // Use URL fragment to avoid leaking tokens via intermediary logs/referer.
    res.redirect(`${frontendUrl}/auth/callback#${params.toString()}`);
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────
// Exchange a refresh token for a new access token (with rotation).
authRouter.post("/refresh", authRefreshIpRateLimit(), async (req, res, next) => {
  try {
    const schema = z.object({
      refreshToken: z.string().min(1),
    });

    const { refreshToken } = schema.parse(req.body);

    // Atomically consume the refresh token for safe rotation.
    const payload = await consumeRefreshToken(refreshToken);

    // Fetch username from Redis or use a default
    // Assumption: We store minimal user info. In production, we'd query the DB.
    const redis = getRedis();
    const username = await redis.get(`user:${payload.sub}:username`) ?? "unknown";

    // Issue new token pair
    const tokens = await generateTokens(payload.sub, username);

    res.json({ success: true, data: tokens });
  } catch (err) {
    if (err instanceof Error && err.message.includes("revoked")) {
      next(new AppError(401, "Refresh token has been revoked"));
      return;
    }
    next(new AppError(401, "Invalid refresh token"));
  }
});

// ── POST /auth/logout ──────────────────────────────────────────────────────
// Invalidate the refresh token.
authRouter.post("/logout", requireAuth, authenticatedApiRateLimit(), async (req, res, next) => {
  try {
    const schema = z.object({
      refreshToken: z.string().min(1),
    });

    const { refreshToken } = schema.parse(req.body);

    // Decode without full verification to get the jti for revocation
    const payload = await verifyRefreshToken(refreshToken);
    await revokeRefreshToken(payload.jti);

    res.json({ success: true });
  } catch {
    // Even if token is invalid/expired, logout succeeds
    res.json({ success: true });
  }
});
