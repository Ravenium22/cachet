import {
  getDb,
  projects,
  contracts,
  roleMappings,
  verifications,
  verificationLogs,
  eq,
  and,
  isNull,
} from "@megaeth-verify/db";
import type { VerifyTokenData, RoleMappingCheck } from "@megaeth-verify/shared";
import { checkRoleMappingBalance } from "./blockchain.js";
import { applyRoleChanges, sendDM, type RoleDelta } from "./roles.js";
import { AppError } from "../middleware/errorHandler.js";
import { syncProjectVerificationCount } from "./subscription.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface VerificationResult {
  walletAddress: string;
  rolesGranted: string[];
  rolesRemoved: string[];
  checks: RoleMappingCheck[];
}

type VerificationSource = "initial" | "manual" | "automatic";

// ── Core orchestration ─────────────────────────────────────────────────────

/**
 * Run the full verification pipeline:
 * 1. Fetch project + role mappings from DB
 * 2. Check on-chain NFT balances for each mapping
 * 3. Determine which roles to add/remove (never revoke on "unknown" RPC errors)
 * 4. Apply role changes via Discord API
 * 5. Persist verification record + audit log
 * 6. DM the user a confirmation
 */
export async function executeVerification(
  tokenData: VerifyTokenData,
  walletAddress: string,
  source: VerificationSource = "initial",
): Promise<VerificationResult> {
  const db = getDb();
  const { projectId, guildId, userDiscordId } = tokenData;

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      isNull(projects.deletedAt),
    ),
  });

  if (!project) {
    throw new AppError(404, "Project not found or archived");
  }

  // 1. Fetch role mappings with their contract info
  const mappings = await db
    .select({
      mappingId: roleMappings.id,
      discordRoleId: roleMappings.discordRoleId,
      minNftCount: roleMappings.minNftCount,
      tokenIds: roleMappings.tokenIds,
      contractAddress: contracts.contractAddress,
      contractType: contracts.contractType,
      isActive: contracts.isActive,
    })
    .from(roleMappings)
    .innerJoin(contracts, eq(roleMappings.contractId, contracts.id))
    .where(eq(roleMappings.projectId, projectId));

  // 2. Check on-chain balances for each active mapping
  const checks: RoleMappingCheck[] = [];
  for (const mapping of mappings) {
    if (!mapping.isActive) continue;

    try {
      const result = await checkRoleMappingBalance(
        mapping.contractAddress,
        mapping.contractType,
        walletAddress,
        mapping.minNftCount,
        mapping.tokenIds,
      );

      checks.push({
        roleMappingId: mapping.mappingId,
        discordRoleId: mapping.discordRoleId,
        status: result.qualified ? "qualified" : "not_qualified",
        balance: result.balance.toString(),
        required: mapping.minNftCount,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`NFT check failed for mapping ${mapping.mappingId}: ${reason}`);
      // Mark as "unknown" — do NOT treat as not-qualified, do NOT revoke roles
      checks.push({
        roleMappingId: mapping.mappingId,
        discordRoleId: mapping.discordRoleId,
        status: "unknown",
        balance: "0",
        required: mapping.minNftCount,
        error: reason,
      });
    }
  }

  // 3. Determine role delta — "unknown" checks do NOT cause removal
  const qualifiedRoleIds = checks
    .filter((c) => c.status === "qualified")
    .map((c) => c.discordRoleId);
  const notQualifiedRoleIds = checks
    .filter((c) => c.status === "not_qualified")
    .map((c) => c.discordRoleId);
  // "unknown" role IDs are left alone — no add, no remove

  // Check what roles the user currently has from a previous verification
  const existingVerification = await db.query.verifications.findFirst({
    where: and(
      eq(verifications.projectId, projectId),
      eq(verifications.userDiscordId, userDiscordId),
    ),
  });

  const previousRoles = existingVerification?.rolesGranted ?? [];

  const delta: RoleDelta = {
    toAdd: qualifiedRoleIds.filter((r) => !previousRoles.includes(r)),
    // Only remove roles we DEFINITIVELY know the user doesn't qualify for
    toRemove: notQualifiedRoleIds.filter((r) => previousRoles.includes(r)),
  };

  // 4. Apply role changes
  const { added, removed, failed } = await applyRoleChanges(guildId, userDiscordId, delta);

  if (failed.length > 0) {
    console.warn(`Role assignment partial failure for user ${userDiscordId}: failed roles=${failed.join(",")}`);
  }

  // The final set of granted roles is: previous roles + added - removed
  const finalRoles = [
    ...previousRoles.filter((r) => !removed.includes(r)),
    ...added,
  ];

  // 5. Persist verification
  const now = new Date();
  const isNewVerification = !existingVerification;
  const unknownCount = checks.filter((c) => c.status === "unknown").length;

  let verificationId: string;

  if (isNewVerification) {
    const [inserted] = await db
      .insert(verifications)
      .values({
        projectId,
        userDiscordId,
        walletAddress,
        rolesGranted: finalRoles,
        verifiedAt: now,
        lastChecked: now,
        status: "active",
      })
      .returning({ id: verifications.id });
    verificationId = inserted.id;
  } else {
    await db
      .update(verifications)
      .set({
        walletAddress,
        rolesGranted: finalRoles,
        lastChecked: now,
        status: "active",
      })
      .where(eq(verifications.id, existingVerification.id));
    verificationId = existingVerification.id;
  }

  // 6. Audit log
  await db.insert(verificationLogs).values({
    verificationId,
    eventType: isNewVerification ? "verified" : "reverified",
    details: {
      source,
      walletAddress,
      checksRun: checks.length,
      unknownChecks: unknownCount,
      rolesAdded: added,
      rolesRemoved: removed,
      rolesFailed: failed,
      qualifiedRoleIds,
      unknownErrors: checks
        .filter((c) => c.status === "unknown")
        .map((c) => ({ roleId: c.discordRoleId, error: c.error })),
    },
  });

  if (added.length > 0 || removed.length > 0) {
    await db.insert(verificationLogs).values({
      verificationId,
      eventType: "roles_updated",
      details: { source, added, removed, failed, finalRoles },
    });
  }

  // Keep subscription usage in sync for billing enforcement.
  await syncProjectVerificationCount(projectId);

  // 7. DM confirmation (best-effort)

  const roleSummary = finalRoles.length > 0
    ? `Roles granted: ${finalRoles.map((r) => `<@&${r}>`).join(", ")}`
    : "No roles were assigned (you may not hold the required NFTs).";

  const lines = [
    `**Verification Complete** for **${project?.name ?? "Unknown Project"}**`,
    "",
    `Wallet: \`${walletAddress}\``,
    roleSummary,
    ...(removed.length > 0 ? [`Roles removed: ${removed.map((r) => `<@&${r}>`).join(", ")}`] : []),
    ...(unknownCount > 0 ? [`\n⚠ ${unknownCount} check(s) could not be completed due to RPC errors. Your existing roles for those were preserved.`] : []),
  ];

  await sendDM(userDiscordId, lines.join("\n")).catch((err) => {
    console.warn(`Failed to DM user ${userDiscordId}:`, err);
  });

  return {
    walletAddress,
    rolesGranted: finalRoles,
    rolesRemoved: removed,
    checks,
  };
}

/**
 * Re-verify a single existing verification record.
 * Called from the dashboard manual reverify action.
 */
export async function reverifyUser(
  verificationId: string,
  source: Exclude<VerificationSource, "initial"> = "manual",
): Promise<VerificationResult> {
  const db = getDb();
  const verification = await db.query.verifications.findFirst({
    where: eq(verifications.id, verificationId),
  });

  if (!verification) {
    throw new Error(`Verification ${verificationId} not found`);
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, verification.projectId),
      isNull(projects.deletedAt),
    ),
  });

  if (!project) {
    throw new Error(`Project ${verification.projectId} not found`);
  }

  const tokenData: VerifyTokenData = {
    projectId: project.id,
    projectName: project.name,
    guildId: project.discordGuildId,
    userDiscordId: verification.userDiscordId,
    nonce: "", // not needed for reverify
    createdAt: Date.now(),
  };

  return executeVerification(tokenData, verification.walletAddress, source);
}
