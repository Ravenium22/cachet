import { Router } from "express";
import { z } from "zod";
import { getDb, roleMappings, contracts, eq, and, sql, inArray } from "@megaeth-verify/db";
import { AppError } from "../middleware/errorHandler.js";
import { requireRoleMappingCapacity } from "../middleware/subscription.js";

export const roleMappingsRouter = Router({ mergeParams: true });

// ── GET /projects/:id/roles ────────────────────────────────────────────────
// List all role mappings for a project, including contract info.
roleMappingsRouter.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const mappings = await db
      .select({
        id: roleMappings.id,
        projectId: roleMappings.projectId,
        contractId: roleMappings.contractId,
        discordRoleId: roleMappings.discordRoleId,
        minNftCount: roleMappings.minNftCount,
        tokenIds: roleMappings.tokenIds,
        requiredTraits: roleMappings.requiredTraits,
        order: roleMappings.order,
        contractAddress: contracts.contractAddress,
        contractType: contracts.contractType,
        contractName: contracts.name,
      })
      .from(roleMappings)
      .innerJoin(contracts, eq(roleMappings.contractId, contracts.id))
      .where(eq(roleMappings.projectId, req.project!.id))
      .orderBy(roleMappings.order);

    res.json({ success: true, data: mappings });
  } catch (err) {
    next(err);
  }
});

// ── POST /projects/:id/roles ───────────────────────────────────────────────
// Create a new role mapping.
const createRoleMappingSchema = z.object({
  contractId: z.string().uuid(),
  discordRoleId: z.string().min(17).max(20),
  minNftCount: z.number().int().min(1).default(1),
  tokenIds: z.array(z.number().int().min(0)).optional(),
});

roleMappingsRouter.post("/", requireRoleMappingCapacity, async (req, res, next) => {
  try {
    const body = createRoleMappingSchema.parse(req.body);
    const db = getDb();
    const projectId = req.project!.id;

    // Verify the contract belongs to this project
    const contract = await db.query.contracts.findFirst({
      where: and(
        eq(contracts.id, body.contractId),
        eq(contracts.projectId, projectId),
      ),
    });

    if (!contract) {
      throw new AppError(404, "Contract not found in this project");
    }

    // ERC-1155 requires token IDs
    if (contract.contractType === "erc1155" && (!body.tokenIds || body.tokenIds.length === 0)) {
      throw new AppError(400, "ERC-1155 contracts require at least one token ID");
    }

    const [created] = await db
      .insert(roleMappings)
      .values({
        projectId,
        contractId: body.contractId,
        discordRoleId: body.discordRoleId,
        minNftCount: body.minNftCount,
        tokenIds: body.tokenIds ?? null,
        order: 9999, // default to end of list
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// ── PUT /projects/:id/roles/reorder ─────────────────────────────────────────
// Reorder multiple role mappings
const reorderRolesSchema = z.object({
  roleMappingIds: z.array(z.string().uuid()),
});

roleMappingsRouter.put("/reorder", async (req, res, next) => {
  try {
    const body = reorderRolesSchema.parse(req.body);
    const db = getDb();
    const projectId = req.project!.id;

    // For simplicity, we loop and update each ID. In production you'd use a transaction and `CASE` statement.
    await db.transaction(async (tx) => {
      for (let i = 0; i < body.roleMappingIds.length; i++) {
        const id = body.roleMappingIds[i];
        await tx
          .update(roleMappings)
          .set({ order: i })
          .where(and(eq(roleMappings.id, id), eq(roleMappings.projectId, projectId)));
      }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /projects/:id/roles/:roleId ──────────────────────────────────────
// Update a role mapping.
const updateRoleMappingSchema = z.object({
  discordRoleId: z.string().min(17).max(20).optional(),
  minNftCount: z.number().int().min(1).optional(),
  tokenIds: z.array(z.number().int().min(0)).nullable().optional(),
});

roleMappingsRouter.patch("/:roleId", async (req, res, next) => {
  try {
    const body = updateRoleMappingSchema.parse(req.body);
    const db = getDb();
    const roleId = req.params["roleId"]!;

    const mapping = await db.query.roleMappings.findFirst({
      where: and(
        eq(roleMappings.id, roleId),
        eq(roleMappings.projectId, req.project!.id),
      ),
    });

    if (!mapping) {
      throw new AppError(404, "Role mapping not found");
    }

    const updates: Record<string, unknown> = {};
    if (body.discordRoleId !== undefined) updates["discordRoleId"] = body.discordRoleId;
    if (body.minNftCount !== undefined) updates["minNftCount"] = body.minNftCount;
    if (body.tokenIds !== undefined) updates["tokenIds"] = body.tokenIds;

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, "No fields to update");
    }

    const [updated] = await db
      .update(roleMappings)
      .set(updates)
      .where(eq(roleMappings.id, roleId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /projects/:id/roles/:roleId ─────────────────────────────────────
// Delete a role mapping.
roleMappingsRouter.delete("/:roleId", async (req, res, next) => {
  try {
    const db = getDb();
    const roleId = req.params["roleId"]!;

    const mapping = await db.query.roleMappings.findFirst({
      where: and(
        eq(roleMappings.id, roleId),
        eq(roleMappings.projectId, req.project!.id),
      ),
    });

    if (!mapping) {
      throw new AppError(404, "Role mapping not found");
    }

    await db.delete(roleMappings).where(eq(roleMappings.id, roleId));
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
