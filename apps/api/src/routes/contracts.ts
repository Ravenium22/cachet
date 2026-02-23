import { Router } from "express";
import { z } from "zod";
import { getDb, contracts, roleMappings, verifications, eq, and, sql } from "@megaeth-verify/db";
import { detectContractType } from "../services/blockchain.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireContractCapacity } from "../middleware/subscription.js";

export const contractsRouter = Router({ mergeParams: true });

// ── GET /projects/:id/contracts ────────────────────────────────────────────
// List all contracts for a project.
contractsRouter.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const projectId = req.project!.id;
    const projectContracts = await db.query.contracts.findMany({
      where: eq(contracts.projectId, projectId),
    });

    const counts = await db
      .select({
        id: contracts.id,
        verifiedMemberCount: sql<number>`count(distinct ${verifications.id})::int`,
      })
      .from(contracts)
      .leftJoin(roleMappings, eq(contracts.id, roleMappings.contractId))
      .leftJoin(
        verifications,
        and(
          eq(verifications.projectId, contracts.projectId),
          eq(verifications.status, "active"),
          sql`${roleMappings.discordRoleId} = ANY(${verifications.rolesGranted})`
        )
      )
      .where(eq(contracts.projectId, projectId))
      .groupBy(contracts.id);

    const countMap = new Map(counts.map(c => [c.id, c.verifiedMemberCount]));

    const data = projectContracts.map(c => ({
      ...c,
      verifiedMemberCount: countMap.get(c.id) || 0
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── POST /projects/:id/contracts ───────────────────────────────────────────
// Add a new contract.
const addContractSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address"),
  contractType: z.enum(["erc721", "erc1155"]),
  name: z.string().max(100).optional(),
});

contractsRouter.post("/", requireContractCapacity, async (req, res, next) => {
  try {
    const body = addContractSchema.parse(req.body);
    const db = getDb();
    const projectId = req.project!.id;
    const normalizedAddress = body.contractAddress.toLowerCase();

    // Check duplicate
    const existing = await db.query.contracts.findFirst({
      where: and(
        eq(contracts.projectId, projectId),
        eq(contracts.contractAddress, normalizedAddress),
      ),
    });

    if (existing) {
      throw new AppError(409, "This contract is already added to the project");
    }

    const [created] = await db
      .insert(contracts)
      .values({
        projectId,
        contractAddress: normalizedAddress,
        contractType: body.contractType,
        name: body.name ?? null,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// ── POST /projects/:id/contracts/detect ────────────────────────────────────
// Auto-detect contract type via ERC-165 supportsInterface.
const detectSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address"),
});

contractsRouter.post("/detect", async (req, res, next) => {
  try {
    const body = detectSchema.parse(req.body);
    const detected = await detectContractType(body.contractAddress);
    res.json({ success: true, data: { contractType: detected } });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /projects/:id/contracts/:contractId ─────────────────────────────
// Remove a contract (cascades to role mappings).
contractsRouter.delete("/:contractId", async (req, res, next) => {
  try {
    const db = getDb();
    const contractId = req.params["contractId"]!;

    const contract = await db.query.contracts.findFirst({
      where: and(
        eq(contracts.id, contractId),
        eq(contracts.projectId, req.project!.id),
      ),
    });

    if (!contract) {
      throw new AppError(404, "Contract not found");
    }

    await db.delete(contracts).where(eq(contracts.id, contractId));
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
