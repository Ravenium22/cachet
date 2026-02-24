import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { verifyMessage, getAddress, type Address } from "viem";
import {
  REDIS_PREFIX,
  VERIFICATION_NONCE_TTL_SECONDS,
  buildVerificationMessage,
  type VerifyTokenData,
} from "@megaeth-verify/shared";
import { getDb, projects, verifications, eq, and, isNull } from "@megaeth-verify/db";
import { getRedis } from "../services/redis.js";
import { requireBotAuth } from "../middleware/botAuth.js";
import { AppError } from "../middleware/errorHandler.js";
import { executeVerification, reverifyUser } from "../services/verification.js";
import { enforceMemberLimitForUser, enforceManualReverifyLimit } from "../services/subscription.js";
import {
  publicApiRateLimit,
  verificationCompletionRateLimit,
  verificationInitiationRateLimit,
} from "../middleware/rateLimit.js";

export const verifyRouter = Router();

// ── POST /verify/initiate ──────────────────────────────────────────────────
// Bot-internal: generates a verification link for a user.
verifyRouter.post("/initiate", requireBotAuth, verificationInitiationRateLimit(), async (req, res, next) => {
  try {
    const schema = z.object({
      guildId: z.string().min(1).max(20),
      userDiscordId: z.string().min(1).max(20),
    });

    const { guildId, userDiscordId } = schema.parse(req.body);

    // Look up project
    const db = getDb();
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.discordGuildId, guildId),
        isNull(projects.deletedAt),
      ),
    });

    if (!project) {
      throw new AppError(404, "No project configured for this server. Run /setup first.");
    }

    await enforceMemberLimitForUser(project.id, userDiscordId);

    // Generate crypto-random token (32 bytes → 64 hex chars) and nonce
    const token = crypto.randomBytes(32).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");

    const tokenData: VerifyTokenData = {
      projectId: project.id,
      projectName: project.name,
      guildId,
      userDiscordId,
      nonce,
      createdAt: Date.now(),
    };

    // Store in Redis with 15-minute TTL
    const redis = getRedis();
    await redis.set(
      `${REDIS_PREFIX.VERIFICATION_NONCE}${token}`,
      JSON.stringify(tokenData),
      "EX",
      VERIFICATION_NONCE_TTL_SECONDS,
    );

    const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
    const verifyUrl = `${frontendUrl}/verify/${token}`;

    res.json({
      success: true,
      data: { token, verifyUrl },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /verify/:token ─────────────────────────────────────────────────────
// Public: validates token, returns project display info + message template.
verifyRouter.get("/:token", publicApiRateLimit(), async (req, res, next) => {
  try {
    const token = req.params.token;
    if (!token || token.length !== 64) {
      throw new AppError(400, "Invalid verification token");
    }

    const redis = getRedis();
    const raw = await redis.get(`${REDIS_PREFIX.VERIFICATION_NONCE}${token}`);

    if (!raw) {
      throw new AppError(404, "Verification link has expired or already been used");
    }

    const data = JSON.parse(raw) as VerifyTokenData;
    const message = buildVerificationMessage(data.projectName, data.nonce);

    res.json({
      success: true,
      data: {
        projectName: data.projectName,
        message,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /verify/:token/complete ───────────────────────────────────────────
// Public: accepts signature + wallet address, verifies, runs NFT checks,
// assigns roles, and persists the verification.
verifyRouter.post("/:token/complete", publicApiRateLimit(), verificationCompletionRateLimit(), async (req, res, next) => {
  try {
    const token = req.params.token;
    if (!token || token.length !== 64) {
      throw new AppError(400, "Invalid verification token");
    }

    const schema = z.object({
      signature: z.string().regex(/^0x[0-9a-fA-F]+$/, "Invalid hex signature"),
      walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum address"),
    });

    const { signature, walletAddress } = schema.parse(req.body);

    // Check token before consuming it so 402 responses do not burn the link.
    const redis = getRedis();
    const redisKey = `${REDIS_PREFIX.VERIFICATION_NONCE}${token}`;
    const rawToken = await redis.get(redisKey);

    if (!rawToken) {
      throw new AppError(404, "Verification link has expired or already been used");
    }

    const previewTokenData = JSON.parse(rawToken) as VerifyTokenData;
    await enforceMemberLimitForUser(previewTokenData.projectId, previewTokenData.userDiscordId);

    // Atomic get-and-delete: fetch token data then immediately remove (single-use)

    // Use a Lua script for atomic get+del to prevent race conditions
    const raw = await redis.eval(
      `local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;`,
      1,
      redisKey,
    ) as string | null;

    if (!raw) {
      throw new AppError(404, "Verification link has expired or already been used");
    }

    const tokenData = JSON.parse(raw) as VerifyTokenData;

    // Reconstruct the expected message
    const expectedMessage = buildVerificationMessage(tokenData.projectName, tokenData.nonce);

    // Verify the signature via ecrecover (EIP-191 personal_sign)
    let checksumAddress: Address;
    try {
      checksumAddress = getAddress(walletAddress);
    } catch {
      throw new AppError(400, "Invalid wallet address checksum");
    }

    const isValid = await verifyMessage({
      address: checksumAddress,
      message: expectedMessage,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      throw new AppError(400, "Signature verification failed. The message was not signed by the provided address.");
    }

    // Run verification pipeline: NFT checks → role assignment → persist → DM
    const result = await executeVerification(tokenData, checksumAddress);

    res.json({
      success: true,
      data: {
        walletAddress: result.walletAddress,
        rolesGranted: result.rolesGranted,
        rolesRemoved: result.rolesRemoved,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /verify/reverify ─────────────────────────────────────────────────
// Bot-internal: force re-verify a user by guild ID + Discord user ID.
verifyRouter.post("/reverify", requireBotAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      guildId: z.string().min(1).max(20),
      userDiscordId: z.string().min(1).max(20),
    });

    const { guildId, userDiscordId } = schema.parse(req.body);

    const db = getDb();
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.discordGuildId, guildId), isNull(projects.deletedAt)),
    });

    if (!project) {
      throw new AppError(404, "No project configured for this server");
    }

    await enforceManualReverifyLimit(project.id);

    const verification = await db.query.verifications.findFirst({
      where: and(
        eq(verifications.projectId, project.id),
        eq(verifications.userDiscordId, userDiscordId),
      ),
    });

    if (!verification) {
      throw new AppError(404, "User has no verification record in this server");
    }

    if (verification.status !== "active") {
      throw new AppError(400, `Verification is ${verification.status}, cannot reverify`);
    }

    const result = await reverifyUser(verification.id, "manual");

    res.json({
      success: true,
      data: {
        walletAddress: result.walletAddress,
        rolesGranted: result.rolesGranted,
        rolesRemoved: result.rolesRemoved,
        stillHoldsNft: result.rolesGranted.length > 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
