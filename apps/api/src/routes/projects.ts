import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectOwner } from "../middleware/projectOwner.js";
import { getDb, projects, eq, and, isNull } from "@megaeth-verify/db";
import { contractsRouter } from "./contracts.js";
import { roleMappingsRouter } from "./roleMappings.js";
import { projectVerificationsRouter } from "./projectVerifications.js";
import { getGuildRoles } from "../services/roles.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureProjectSubscription } from "../services/subscription.js";
import { authenticatedApiRateLimit } from "../middleware/rateLimit.js";

export const projectsRouter = Router();

// All project routes require authentication
projectsRouter.use(requireAuth);
projectsRouter.use(authenticatedApiRateLimit());

// ── GET /projects ──────────────────────────────────────────────────────────
// List all projects owned by the authenticated user.
projectsRouter.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const userProjects = await db.query.projects.findMany({
      where: and(
        eq(projects.ownerDiscordId, req.user!.sub),
        isNull(projects.deletedAt),
      ),
    });

    res.json({ success: true, data: userProjects });
  } catch (err) {
    next(err);
  }
});

// ── POST /projects ─────────────────────────────────────────────────────────
// Create a new project.
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  discordGuildId: z.string().min(17).max(20),
});

projectsRouter.post("/", async (req, res, next) => {
  try {
    const body = createProjectSchema.parse(req.body);
    const db = getDb();

    // Check if a project already exists for this guild
    const existing = await db.query.projects.findFirst({
      where: eq(projects.discordGuildId, body.discordGuildId),
    });

    if (existing) {
      throw new AppError(409, "A project already exists for this Discord server");
    }

    const [created] = await db
      .insert(projects)
      .values({
        name: body.name,
        discordGuildId: body.discordGuildId,
        ownerDiscordId: req.user!.sub,
      })
      .returning();

    await ensureProjectSubscription(created.id);

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// ── GET /projects/:id ──────────────────────────────────────────────────────
// Get project details (owner only).
projectsRouter.get("/:id", requireProjectOwner, (req, res) => {
  res.json({ success: true, data: req.project });
});

// ── PATCH /projects/:id ────────────────────────────────────────────────────
// Update project settings.
const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
});

projectsRouter.patch("/:id", requireProjectOwner, async (req, res, next) => {
  try {
    const body = updateProjectSchema.parse(req.body);
    const db = getDb();

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates["name"] = body.name;
    if (body.settings !== undefined) {
      // Merge with existing settings instead of replacing
      const existing = (req.project!.settings ?? {}) as Record<string, unknown>;
      updates["settings"] = { ...existing, ...body.settings };
    }

    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, req.project!.id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /projects/:id ───────────────────────────────────────────────────
// Soft-delete project (preserves related data for retention/cleanup).
projectsRouter.delete("/:id", requireProjectOwner, async (req, res, next) => {
  try {
    const db = getDb();
    await db
      .update(projects)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, req.project!.id));
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// ── GET /projects/:id/discord-roles ────────────────────────────────────────
// Fetch available Discord roles for the project's guild.
projectsRouter.get("/:id/discord-roles", requireProjectOwner, async (req, res, next) => {
  try {
    const roles = await getGuildRoles(req.project!.discordGuildId);
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
});

// ── Sub-routers ────────────────────────────────────────────────────────────
projectsRouter.use("/:id/contracts", requireProjectOwner, contractsRouter);
projectsRouter.use("/:id/roles", requireProjectOwner, roleMappingsRouter);
projectsRouter.use("/:id/verifications", requireProjectOwner, projectVerificationsRouter);
