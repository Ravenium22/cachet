import { Router } from "express";
import { z } from "zod";
import { getDb, verifications, verificationLogs, eq, and, desc, count, sql } from "@megaeth-verify/db";
import { reverifyUser } from "../services/verification.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireManualReverifyCapacity } from "../middleware/subscription.js";

export const projectVerificationsRouter = Router({ mergeParams: true });

// ── GET /projects/:id/verifications ────────────────────────────────────────
// List verifications with pagination and optional filters.
const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "expired", "revoked"]).optional(),
  search: z.string().max(100).optional(),
});

projectVerificationsRouter.get("/", async (req, res, next) => {
  try {
    const query = listSchema.parse(req.query);
    const db = getDb();
    const projectId = req.project!.id;
    const offset = (query.page - 1) * query.limit;

    // Build where conditions
    const conditions = [eq(verifications.projectId, projectId)];

    if (query.status) {
      conditions.push(eq(verifications.status, query.status));
    }

    if (query.search) {
      conditions.push(
        sql`(${verifications.walletAddress} ILIKE ${'%' + query.search + '%'} OR ${verifications.userDiscordId} LIKE ${'%' + query.search + '%'})`,
      );
    }

    const whereClause = and(...conditions);

    const [items, [totalRow]] = await Promise.all([
      db
        .select()
        .from(verifications)
        .where(whereClause)
        .orderBy(desc(verifications.lastChecked))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(verifications)
        .where(whereClause),
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: totalRow.total,
          totalPages: Math.ceil(totalRow.total / query.limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /projects/:id/verifications/stats ──────────────────────────────────
// Get verification statistics for the project.
projectVerificationsRouter.get("/stats", async (req, res, next) => {
  try {
    const db = getDb();
    const projectId = req.project!.id;

    const [totalResult] = await db
      .select({ total: count() })
      .from(verifications)
      .where(eq(verifications.projectId, projectId));

    const [activeResult] = await db
      .select({ total: count() })
      .from(verifications)
      .where(and(
        eq(verifications.projectId, projectId),
        eq(verifications.status, "active"),
      ));

    // Recent verifications (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentResult] = await db
      .select({ total: count() })
      .from(verifications)
      .where(and(
        eq(verifications.projectId, projectId),
        sql`${verifications.verifiedAt} >= ${sevenDaysAgo}`,
      ));

    // Recent activity (last 10 log entries)
    const recentLogs = await db
      .select({
        id: verificationLogs.id,
        eventType: verificationLogs.eventType,
        details: verificationLogs.details,
        createdAt: verificationLogs.createdAt,
        userDiscordId: verifications.userDiscordId,
        walletAddress: verifications.walletAddress,
      })
      .from(verificationLogs)
      .innerJoin(verifications, eq(verificationLogs.verificationId, verifications.id))
      .where(eq(verifications.projectId, projectId))
      .orderBy(desc(verificationLogs.createdAt))
      .limit(10);

    res.json({
      success: true,
      data: {
        totalVerifications: totalResult.total,
        activeVerifications: activeResult.total,
        recentVerifications: recentResult.total,
        recentActivity: recentLogs,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /projects/:id/verifications/daily ───────────────────────────────────
// Daily verification counts for the last 30 days (for charts).
projectVerificationsRouter.get("/daily", async (req, res, next) => {
  try {
    const db = getDb();
    const projectId = req.project!.id;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyCounts = await db
      .select({
        date: sql<string>`DATE(${verifications.verifiedAt})::text`,
        count: count(),
      })
      .from(verifications)
      .where(and(
        eq(verifications.projectId, projectId),
        sql`${verifications.verifiedAt} >= ${thirtyDaysAgo}`,
      ))
      .groupBy(sql`DATE(${verifications.verifiedAt})`)
      .orderBy(sql`DATE(${verifications.verifiedAt})`);

    res.json({ success: true, data: dailyCounts });
  } catch (err) {
    next(err);
  }
});

// ── POST /projects/:id/verifications/:verificationId/reverify ──────────────
// Manually re-verify a user.
projectVerificationsRouter.post("/:verificationId/reverify", requireManualReverifyCapacity, async (req, res, next) => {
  try {
    const verificationIdParam = req.params["verificationId"];
    if (typeof verificationIdParam !== "string") {
      throw new AppError(400, "Verification ID is required");
    }

    const verificationId = verificationIdParam;
    const db = getDb();

    // Verify this verification belongs to the project
    const verification = await db.query.verifications.findFirst({
      where: and(
        eq(verifications.id, verificationId),
        eq(verifications.projectId, req.project!.id),
      ),
    });

    if (!verification) {
      throw new AppError(404, "Verification not found");
    }

    const result = await reverifyUser(verificationId, "manual");
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
