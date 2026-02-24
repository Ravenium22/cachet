import { Router } from "express";
import { z } from "zod";
import {
  getDb,
  projects,
  subscriptions,
  cryptoPayments,
  verifications,
  eq,
  and,
  sql,
  desc,
  isNull,
  count,
} from "@megaeth-verify/db";
import { requireAdminAuth } from "../middleware/adminAuth.js";
import { upsertProjectSubscription } from "../services/subscription.js";
import { AppError } from "../middleware/errorHandler.js";
import { logger } from "../services/logger.js";

export const adminRouter = Router();
adminRouter.use(requireAdminAuth);

// ── GET /admin/stats ──────────────────────────────────────────────────────

adminRouter.get("/stats", async (_req, res, next) => {
  try {
    const db = getDb();

    const [projectStats] = await db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${projects.deletedAt} is null)`,
      })
      .from(projects);

    const tierBreakdown = await db
      .select({
        tier: subscriptions.tier,
        count: count(),
      })
      .from(subscriptions)
      .groupBy(subscriptions.tier);

    const statusBreakdown = await db
      .select({
        status: subscriptions.status,
        count: count(),
      })
      .from(subscriptions)
      .groupBy(subscriptions.status);

    const [cryptoStats] = await db
      .select({
        total: count(),
        confirmed: sql<number>`count(*) filter (where ${cryptoPayments.status} = 'confirmed')`,
        revenueUsdCents: sql<number>`coalesce(sum(${cryptoPayments.amountUsdCents}) filter (where ${cryptoPayments.status} = 'confirmed'), 0)`,
      })
      .from(cryptoPayments);

    const [verificationStats] = await db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${verifications.status} = 'active')`,
      })
      .from(verifications);

    res.json({
      success: true,
      data: {
        projects: {
          total: projectStats.total,
          active: projectStats.active,
        },
        subscriptions: {
          byTier: tierBreakdown,
          byStatus: statusBreakdown,
        },
        crypto: {
          totalPayments: cryptoStats.total,
          confirmedPayments: cryptoStats.confirmed,
          revenueUsdCents: Number(cryptoStats.revenueUsdCents),
        },
        verifications: {
          total: verificationStats.total,
          active: verificationStats.active,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/payments/recent ────────────────────────────────────────────

const recentPaymentsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

adminRouter.get("/payments/recent", async (req, res, next) => {
  try {
    const { limit, offset } = recentPaymentsSchema.parse(req.query);
    const db = getDb();

    const rows = await db
      .select({
        id: cryptoPayments.id,
        projectId: cryptoPayments.projectId,
        projectName: projects.name,
        tier: cryptoPayments.tier,
        billingPeriod: cryptoPayments.billingPeriod,
        amountUsdCents: cryptoPayments.amountUsdCents,
        token: cryptoPayments.token,
        chain: cryptoPayments.chain,
        txHash: cryptoPayments.txHash,
        status: cryptoPayments.status,
        createdAt: cryptoPayments.createdAt,
        confirmedAt: cryptoPayments.confirmedAt,
      })
      .from(cryptoPayments)
      .innerJoin(projects, eq(cryptoPayments.projectId, projects.id))
      .orderBy(desc(cryptoPayments.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(cryptoPayments);

    res.json({ success: true, data: { payments: rows, total } });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/projects/search ────────────────────────────────────────────

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

adminRouter.get("/projects/search", async (req, res, next) => {
  try {
    const { q, limit } = searchSchema.parse(req.query);
    const db = getDb();

    // Search by name (ILIKE), guild ID (exact), or project UUID (exact)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        discordGuildId: projects.discordGuildId,
        ownerDiscordId: projects.ownerDiscordId,
        createdAt: projects.createdAt,
        deletedAt: projects.deletedAt,
        tier: subscriptions.tier,
        subscriptionStatus: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        verificationCount: subscriptions.verificationCount,
      })
      .from(projects)
      .leftJoin(subscriptions, eq(projects.id, subscriptions.projectId))
      .where(
        isUuid
          ? eq(projects.id, q)
          : sql`(${projects.name} ilike ${"%" + q + "%"} or ${projects.discordGuildId} = ${q} or ${projects.ownerDiscordId} = ${q})`,
      )
      .orderBy(desc(projects.createdAt))
      .limit(limit);

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/projects/:projectId ────────────────────────────────────────

adminRouter.get("/projects/:projectId", async (req, res, next) => {
  try {
    const projectId = z.string().uuid().parse(req.params.projectId);
    const db = getDb();

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) throw new AppError(404, "Project not found");

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.projectId, projectId),
    });

    const [verificationStats] = await db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${verifications.status} = 'active')`,
      })
      .from(verifications)
      .where(eq(verifications.projectId, projectId));

    const payments = await db
      .select()
      .from(cryptoPayments)
      .where(eq(cryptoPayments.projectId, projectId))
      .orderBy(desc(cryptoPayments.createdAt))
      .limit(10);

    res.json({
      success: true,
      data: {
        project,
        subscription: subscription ?? null,
        verifications: verificationStats,
        recentPayments: payments,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /admin/projects/:projectId/subscription ──────────────────────────

const overrideSchema = z.object({
  tier: z.enum(["free", "growth", "pro", "enterprise"]),
  status: z.enum(["active", "past_due", "cancelled"]),
  currentPeriodEnd: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

adminRouter.post("/projects/:projectId/subscription", async (req, res, next) => {
  try {
    const projectId = z.string().uuid().parse(req.params.projectId);
    const body = overrideSchema.parse(req.body);

    const db = getDb();
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
    });
    if (!project) throw new AppError(404, "Project not found");

    const updated = await upsertProjectSubscription(projectId, {
      tier: body.tier,
      status: body.status,
      currentPeriodEnd: new Date(body.currentPeriodEnd),
    });

    logger.info(
      { projectId, projectName: project.name, tier: body.tier, status: body.status, notes: body.notes },
      "Admin subscription override",
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
