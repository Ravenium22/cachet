import { Router } from "express";
import { z } from "zod";
import { Queue } from "bullmq";
import { getDb, projects, and, eq, isNull } from "@megaeth-verify/db";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { authenticatedApiRateLimit } from "../middleware/rateLimit.js";
import {
  createCryptoInvoice,
  submitTxHash,
  getInvoice,
  getInvoicesForProject,
} from "../services/cryptoPayment.js";

export const cryptoBillingRouter = Router();

// Lazy queue reference — set by worker startup or on first use
let verifyQueue: Queue | null = null;

export function setCryptoVerifyQueue(queue: Queue) {
  verifyQueue = queue;
}

function getRedisConnection() {
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) throw new Error("REDIS_URL environment variable is required");
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

function getVerifyQueue(): Queue {
  if (!verifyQueue) {
    verifyQueue = new Queue("crypto-verify-payment", {
      connection: getRedisConnection(),
    });
  }
  return verifyQueue;
}

async function getOwnedProject(projectId: string, ownerDiscordId: string) {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.ownerDiscordId, ownerDiscordId),
      isNull(projects.deletedAt),
    ),
  });
  if (!project) throw new AppError(404, "Project not found");
  return project;
}

// ── POST /billing/crypto/checkout ─────────────────────────────────────────

const checkoutSchema = z.object({
  projectId: z.string().uuid(),
  tier: z.enum(["growth", "pro"]),
  billingPeriod: z.enum(["monthly", "annual"]),
  token: z.enum(["usdc", "usdt"]),
  chain: z.enum(["ethereum", "base", "arbitrum"]),
});

cryptoBillingRouter.post("/checkout", requireAuth, authenticatedApiRateLimit(), async (req, res, next) => {
  try {
    const body = checkoutSchema.parse(req.body);
    await getOwnedProject(body.projectId, req.user!.sub);

    const invoice = await createCryptoInvoice(
      body.projectId,
      body.tier,
      body.billingPeriod,
      body.token,
      body.chain,
    );

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

// ── POST /billing/crypto/submit-tx ────────────────────────────────────────

const submitTxSchema = z.object({
  invoiceId: z.string().uuid(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
});

cryptoBillingRouter.post("/submit-tx", requireAuth, authenticatedApiRateLimit(), async (req, res, next) => {
  try {
    const body = submitTxSchema.parse(req.body);

    // Verify ownership before allowing tx submission
    const existing = await getInvoice(body.invoiceId);
    if (!existing) throw new AppError(404, "Invoice not found");
    await getOwnedProject(existing.projectId, req.user!.sub);

    const invoice = await submitTxHash(body.invoiceId, body.txHash);

    // Enqueue verification job
    await getVerifyQueue().add(
      "verify-crypto-payment",
      { invoiceId: body.invoiceId },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

// ── GET /billing/crypto/invoice/:id ───────────────────────────────────────

cryptoBillingRouter.get("/invoice/:id", requireAuth, authenticatedApiRateLimit(), async (req, res, next) => {
  try {
    const invoiceId = z.string().uuid().parse(req.params.id);
    const invoice = await getInvoice(invoiceId);

    if (!invoice) throw new AppError(404, "Invoice not found");

    // Verify ownership
    await getOwnedProject(invoice.projectId, req.user!.sub);

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

// ── GET /billing/crypto/invoices ──────────────────────────────────────────

const invoicesQuerySchema = z.object({
  projectId: z.string().uuid(),
});

cryptoBillingRouter.get("/invoices", requireAuth, authenticatedApiRateLimit(), async (req, res, next) => {
  try {
    const query = invoicesQuerySchema.parse(req.query);
    await getOwnedProject(query.projectId, req.user!.sub);

    const invoices = await getInvoicesForProject(query.projectId);

    res.json({ success: true, data: invoices });
  } catch (err) {
    next(err);
  }
});
