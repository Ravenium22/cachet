import {
  getDb,
  subscriptions,
  verifications,
  contracts,
  roleMappings,
  verificationLogs,
  eq,
  and,
  count,
  gte,
  sql,
} from "@megaeth-verify/db";
import {
  BILLING_GRACE_PERIOD_DAYS,
  TIER_LIMITS,
  type SubscriptionTier,
  type SubscriptionStatus,
} from "@megaeth-verify/shared";
import { AppError } from "../middleware/errorHandler.js";

const TIER_ORDER: SubscriptionTier[] = ["free", "growth", "pro", "enterprise"];

type SubscriptionRow = typeof subscriptions.$inferSelect;

type MutableSubscriptionFields = {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd: Date;
};

export interface EffectiveSubscription {
  subscription: SubscriptionRow;
  effectiveTier: SubscriptionTier;
  inGracePeriod: boolean;
}

export interface UpgradeRequiredDetails {
  code: "tier_limit_exceeded";
  projectId: string;
  currentTier: SubscriptionTier;
  suggestedTier: SubscriptionTier;
  limitType:
    | "maxVerifiedMembers"
    | "maxContracts"
    | "maxRoleMappings"
    | "maxAdminChecksPerMonth";
  limit: number;
  usage: number;
}

function freePeriodEnd(): Date {
  const now = new Date();
  now.setFullYear(now.getFullYear() + 100);
  return now;
}

function gracePeriodEnd(): Date {
  const now = new Date();
  now.setDate(now.getDate() + BILLING_GRACE_PERIOD_DAYS);
  return now;
}

function suggestedTierForLimit(
  limitType:
    | "maxVerifiedMembers"
    | "maxContracts"
    | "maxRoleMappings"
    | "maxAdminChecksPerMonth",
  usage: number,
): SubscriptionTier {
  for (const tier of TIER_ORDER) {
    const limit = TIER_LIMITS[tier][limitType];
    if (!Number.isFinite(limit) || limit > usage) {
      return tier;
    }
  }

  return "enterprise";
}

function buildUpgradeDetails(
  projectId: string,
  currentTier: SubscriptionTier,
  limitType:
    | "maxVerifiedMembers"
    | "maxContracts"
    | "maxRoleMappings"
    | "maxAdminChecksPerMonth",
  usage: number,
): UpgradeRequiredDetails {
  const limits = TIER_LIMITS[currentTier];
  return {
    code: "tier_limit_exceeded",
    projectId,
    currentTier,
    suggestedTier: suggestedTierForLimit(limitType, usage),
    limitType,
    limit: limits[limitType],
    usage,
  };
}

export function isWithinGracePeriod(subscription: SubscriptionRow): boolean {
  return subscription.status === "past_due" && subscription.currentPeriodEnd.getTime() > Date.now();
}

async function downgradeIfGraceExpired(subscription: SubscriptionRow): Promise<SubscriptionRow> {
  if (subscription.status !== "past_due") {
    return subscription;
  }

  if (subscription.currentPeriodEnd.getTime() > Date.now()) {
    return subscription;
  }

  const db = getDb();
  const [downgraded] = await db
    .update(subscriptions)
    .set({
      tier: "free",
      status: "cancelled",
      currentPeriodEnd: freePeriodEnd(),
      stripeSubscriptionId: null,
    })
    .where(eq(subscriptions.id, subscription.id))
    .returning();

  return downgraded;
}

export async function ensureProjectSubscription(projectId: string): Promise<SubscriptionRow> {
  const db = getDb();
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.projectId, projectId),
  });

  if (existing) {
    return downgradeIfGraceExpired(existing);
  }

  const [created] = await db
    .insert(subscriptions)
    .values({
      projectId,
      tier: "free",
      status: "active",
      currentPeriodEnd: freePeriodEnd(),
      verificationCount: 0,
    })
    .returning();

  return created;
}

export async function getEffectiveSubscription(projectId: string): Promise<EffectiveSubscription> {
  const subscription = await ensureProjectSubscription(projectId);

  if (subscription.status === "active") {
    return {
      subscription,
      effectiveTier: subscription.tier,
      inGracePeriod: false,
    };
  }

  if (isWithinGracePeriod(subscription)) {
    return {
      subscription,
      effectiveTier: subscription.tier,
      inGracePeriod: true,
    };
  }

  return {
    subscription,
    effectiveTier: "free",
    inGracePeriod: false,
  };
}

export async function syncProjectVerificationCount(projectId: string): Promise<number> {
  const db = getDb();

  const [row] = await db
    .select({ total: count() })
    .from(verifications)
    .where(and(
      eq(verifications.projectId, projectId),
      eq(verifications.status, "active"),
    ));

  await ensureProjectSubscription(projectId);
  await db
    .update(subscriptions)
    .set({ verificationCount: row.total })
    .where(eq(subscriptions.projectId, projectId));

  return row.total;
}

export async function upsertProjectSubscription(
  projectId: string,
  fields: MutableSubscriptionFields,
): Promise<SubscriptionRow> {
  const db = getDb();
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.projectId, projectId),
  });

  if (existing) {
    const [updated] = await db
      .update(subscriptions)
      .set({
        tier: fields.tier,
        status: fields.status,
        stripeCustomerId: fields.stripeCustomerId ?? existing.stripeCustomerId,
        stripeSubscriptionId: fields.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        currentPeriodEnd: fields.currentPeriodEnd,
      })
      .where(eq(subscriptions.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(subscriptions)
    .values({
      projectId,
      tier: fields.tier,
      status: fields.status,
      stripeCustomerId: fields.stripeCustomerId ?? null,
      stripeSubscriptionId: fields.stripeSubscriptionId ?? null,
      currentPeriodEnd: fields.currentPeriodEnd,
      verificationCount: 0,
    })
    .returning();

  return created;
}

export async function markPaymentFailedWithGrace(
  projectId: string,
  stripeCustomerId?: string | null,
  stripeSubscriptionId?: string | null,
): Promise<SubscriptionRow> {
  const db = getDb();
  const subscription = await ensureProjectSubscription(projectId);

  // Ignore stale events that point at a different subscription.
  if (
    stripeSubscriptionId &&
    subscription.stripeSubscriptionId &&
    subscription.stripeSubscriptionId !== stripeSubscriptionId
  ) {
    return subscription;
  }

  // Do not resurrect fully cancelled free subscriptions on late invoice events.
  if (subscription.tier === "free" && subscription.status === "cancelled") {
    return subscription;
  }

  const nextPeriodEnd = subscription.status === "past_due" && subscription.currentPeriodEnd > new Date()
    ? subscription.currentPeriodEnd
    : gracePeriodEnd();

  const [updated] = await db
    .update(subscriptions)
    .set({
      status: "past_due",
      currentPeriodEnd: nextPeriodEnd,
      stripeCustomerId: stripeCustomerId ?? subscription.stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId ?? subscription.stripeSubscriptionId,
    })
    .where(eq(subscriptions.id, subscription.id))
    .returning();

  return updated;
}

export async function findSubscriptionByStripeSubscriptionId(
  stripeSubscriptionId: string,
): Promise<SubscriptionRow | null> {
  const db = getDb();
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId),
  });
  return subscription ?? null;
}

export async function enforceContractLimit(projectId: string): Promise<void> {
  const db = getDb();
  const { effectiveTier } = await getEffectiveSubscription(projectId);
  const limit = TIER_LIMITS[effectiveTier].maxContracts;

  if (!Number.isFinite(limit)) {
    return;
  }

  const [row] = await db
    .select({ total: count() })
    .from(contracts)
    .where(eq(contracts.projectId, projectId));

  if (row.total >= limit) {
    throw new AppError(
      402,
      "Contract limit reached for your plan. Please upgrade to add more contracts.",
      buildUpgradeDetails(projectId, effectiveTier, "maxContracts", row.total),
    );
  }
}

export async function enforceRoleMappingLimit(projectId: string): Promise<void> {
  const db = getDb();
  const { effectiveTier } = await getEffectiveSubscription(projectId);
  const limit = TIER_LIMITS[effectiveTier].maxRoleMappings;

  if (!Number.isFinite(limit)) {
    return;
  }

  const [row] = await db
    .select({ total: count() })
    .from(roleMappings)
    .where(eq(roleMappings.projectId, projectId));

  if (row.total >= limit) {
    throw new AppError(
      402,
      "Role mapping limit reached for your plan. Please upgrade to add more mappings.",
      buildUpgradeDetails(projectId, effectiveTier, "maxRoleMappings", row.total),
    );
  }
}

export async function enforceManualReverifyLimit(projectId: string): Promise<void> {
  const db = getDb();
  const { effectiveTier } = await getEffectiveSubscription(projectId);
  const limit = TIER_LIMITS[effectiveTier].maxAdminChecksPerMonth;

  if (!Number.isFinite(limit)) {
    return;
  }

  if (limit <= 0) {
    throw new AppError(
      402,
      "Admin-initiated re-verification is not available on your current plan.",
      buildUpgradeDetails(projectId, effectiveTier, "maxAdminChecksPerMonth", 0),
    );
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ total: count() })
    .from(verificationLogs)
    .innerJoin(verifications, eq(verificationLogs.verificationId, verifications.id))
    .where(and(
      eq(verifications.projectId, projectId),
      eq(verificationLogs.eventType, "reverified"),
      gte(verificationLogs.createdAt, monthStart),
      sql`${verificationLogs.details}->>'source' = 'manual'`,
    ));

  if (row.total >= limit) {
    throw new AppError(
      402,
      "Admin re-verification limit reached for this month. Please upgrade to continue.",
      buildUpgradeDetails(projectId, effectiveTier, "maxAdminChecksPerMonth", row.total),
    );
  }
}

export async function enforceMemberLimitForUser(
  projectId: string,
  userDiscordId: string,
): Promise<void> {
  const db = getDb();
  const { effectiveTier } = await getEffectiveSubscription(projectId);
  const limit = TIER_LIMITS[effectiveTier].maxVerifiedMembers;

  if (!Number.isFinite(limit)) {
    return;
  }

  // Existing verifications are always allowed to re-verify.
  const existing = await db.query.verifications.findFirst({
    where: and(
      eq(verifications.projectId, projectId),
      eq(verifications.userDiscordId, userDiscordId),
    ),
  });

  if (existing) {
    return;
  }

  const [row] = await db
    .select({ total: count() })
    .from(verifications)
    .where(and(
      eq(verifications.projectId, projectId),
      eq(verifications.status, "active"),
    ));

  if (row.total >= limit) {
    throw new AppError(
      402,
      "Verified member limit reached for your plan. Upgrade to verify more members.",
      buildUpgradeDetails(projectId, effectiveTier, "maxVerifiedMembers", row.total),
    );
  }
}

export async function findProjectIdByStripeCustomerId(customerId: string): Promise<string | null> {
  const db = getDb();
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, customerId),
  });

  return subscription?.projectId ?? null;
}

// Alias functions for Paddle (using same DB columns)
export const findSubscriptionByPaddleSubscriptionId = findSubscriptionByStripeSubscriptionId;
export const findProjectIdByPaddleCustomerId = findProjectIdByStripeCustomerId;
