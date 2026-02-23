import { Router } from "express";
import { z } from "zod";
import {
  BILLING_PLANS,
  TIER_LIMITS,
  type SubscriptionTier,
} from "@megaeth-verify/shared";
import { getDb, projects, and, eq, isNull } from "@megaeth-verify/db";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { authenticatedApiRateLimit, publicApiRateLimit } from "../middleware/rateLimit.js";
import {
  ensureProjectSubscription,
  getEffectiveSubscription,
  upsertProjectSubscription,
} from "../services/subscription.js";
import {
  createPaddleCheckout,
  createPaddleCustomer,
  getPaddle,
  getPaddleSubscription,
  getPaddleSubscriptionManagementUrls,
  getTierFromPaddlePriceId,
} from "../services/paddle.js";
import { logger } from "../services/logger.js";

export const billingRouter = Router();

function getFrontendUrl(): string {
  return process.env["FRONTEND_URL"] ?? "http://localhost:3000";
}

function serializeLimit(limit: number): number | null {
  return Number.isFinite(limit) ? limit : null;
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

  if (!project) {
    throw new AppError(404, "Project not found");
  }

  return project;
}

billingRouter.get("/plans", publicApiRateLimit(), (_req, res) => {
  const plans = BILLING_PLANS.map((plan) => ({
    ...plan,
    limits: {
      maxVerifiedMembers: serializeLimit(TIER_LIMITS[plan.tier].maxVerifiedMembers),
      maxServers: serializeLimit(TIER_LIMITS[plan.tier].maxServers),
      maxContracts: serializeLimit(TIER_LIMITS[plan.tier].maxContracts),
      maxRoleMappings: serializeLimit(TIER_LIMITS[plan.tier].maxRoleMappings),
      maxAdminChecksPerMonth: serializeLimit(TIER_LIMITS[plan.tier].maxAdminChecksPerMonth),
    },
  }));

  res.json({ success: true, data: plans });
});

const subscriptionQuerySchema = z.object({
  projectId: z.string().uuid(),
});

billingRouter.get("/subscription", requireAuth, authenticatedApiRateLimit(), async (req, res, next) => {
  try {
    const query = subscriptionQuerySchema.parse(req.query);
    const project = await getOwnedProject(query.projectId, req.user!.sub);
    const { subscription, effectiveTier, inGracePeriod } = await getEffectiveSubscription(project.id);

    res.json({
      success: true,
      data: {
        tier: effectiveTier as SubscriptionTier,
        status: subscription.status,
        inGracePeriod,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (err) {
    next(err);
  }
});

const checkoutSchema = z.object({
  projectId: z.string().uuid(),
  tier: z.enum(["growth", "pro"]),
});

billingRouter.post("/checkout", requireAuth, authenticatedApiRateLimit(), async (req, res, next) => {
  try {
    const body = checkoutSchema.parse(req.body);
    const project = await getOwnedProject(body.projectId, req.user!.sub);

    const subscription = await ensureProjectSubscription(project.id);

    // Create Paddle customer if not exists
    let paddleCustomerId = subscription.stripeCustomerId; // Re-using field for Paddle
    if (!paddleCustomerId) {
      paddleCustomerId = await createPaddleCustomer(project.id, project.name);

      await upsertProjectSubscription(project.id, {
        tier: subscription.tier,
        status: subscription.status,
        stripeCustomerId: paddleCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        currentPeriodEnd: subscription.currentPeriodEnd,
      });
    }

    const successUrl = `${getFrontendUrl()}/dashboard/${project.id}/settings?billing=success`;

    const checkout = await createPaddleCheckout({
      customerId: paddleCustomerId,
      projectId: project.id,
      tier: body.tier,
      successUrl,
    });

    res.json({
      success: true,
      data: {
        id: checkout.transactionId,
        url: checkout.checkoutUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

const portalSchema = z.object({
  projectId: z.string().uuid(),
});

billingRouter.post("/portal", requireAuth, authenticatedApiRateLimit(), async (req, res, next) => {
  try {
    const body = portalSchema.parse(req.body);
    const project = await getOwnedProject(body.projectId, req.user!.sub);

    const subscription = await ensureProjectSubscription(project.id);
    if (!subscription.stripeSubscriptionId) {
      throw new AppError(400, "No active subscription found for this project.");
    }

    // Get the Paddle subscription to retrieve management URLs
    const paddleSubscription = await getPaddleSubscription(subscription.stripeSubscriptionId);
    const managementUrls = getPaddleSubscriptionManagementUrls(paddleSubscription);

    const { effectiveTier, inGracePeriod } = await getEffectiveSubscription(project.id);

    res.json({
      success: true,
      data: {
        url: managementUrls.updatePaymentMethod ?? managementUrls.cancel,
        cancelUrl: managementUrls.cancel,
        updatePaymentUrl: managementUrls.updatePaymentMethod,
        tier: effectiveTier as SubscriptionTier,
        inGracePeriod,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /billing/activate ────────────────────────────────────────────────
// Poll Paddle directly for transaction/subscription status after checkout.
// This bypasses webhook dependency so the UI doesn't stay stuck.
const activateSchema = z.object({
  projectId: z.string().uuid(),
  transactionId: z.string().min(1),
});

billingRouter.post("/activate", requireAuth, authenticatedApiRateLimit(), async (req, res, next) => {
  try {
    const body = activateSchema.parse(req.body);
    const project = await getOwnedProject(body.projectId, req.user!.sub);

    const paddle = getPaddle();
    let transaction;
    try {
      transaction = await paddle.transactions.get(body.transactionId);
    } catch (err) {
      logger.warn({ transactionId: body.transactionId, err }, "Failed to fetch Paddle transaction");
      throw new AppError(404, "Transaction not found");
    }

    // Verify the transaction belongs to this project
    const txCustomData = transaction.customData as { projectId?: string; tier?: string } | null;
    if (txCustomData?.projectId !== project.id) {
      throw new AppError(403, "Transaction does not belong to this project");
    }

    const txStatus = transaction.status as string;
    const subscriptionId = (transaction as unknown as { subscriptionId?: string }).subscriptionId;

    logger.info(
      { transactionId: body.transactionId, txStatus, subscriptionId, customData: txCustomData },
      "Activate: Paddle transaction status",
    );

    // If the transaction isn't completed yet, return current state
    if (txStatus !== "completed" && txStatus !== "billed") {
      const { effectiveTier } = await getEffectiveSubscription(project.id);
      res.json({
        success: true,
        data: {
          activated: false,
          tier: effectiveTier as SubscriptionTier,
          transactionStatus: txStatus,
        },
      });
      return;
    }

    // Transaction is completed — resolve the tier
    const tier = (txCustomData?.tier as SubscriptionTier) ?? null;
    const priceTier = getTierFromPaddlePriceId(
      transaction.items?.[0]?.price?.id,
    );
    const resolvedTier = tier ?? priceTier ?? "growth";

    if (subscriptionId) {
      // Fetch subscription details for period end
      try {
        const paddleSub = await paddle.subscriptions.get(subscriptionId);
        const periodEnd = (paddleSub as unknown as { currentBillingPeriod?: { endsAt?: string } })
          .currentBillingPeriod?.endsAt
          ? new Date((paddleSub as unknown as { currentBillingPeriod: { endsAt: string } }).currentBillingPeriod.endsAt)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await upsertProjectSubscription(project.id, {
          tier: resolvedTier,
          status: "active",
          stripeCustomerId: transaction.customerId ?? undefined,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd: periodEnd,
        });
      } catch (subErr) {
        logger.warn({ subscriptionId, err: subErr }, "Failed to fetch Paddle subscription; using fallback period");
        await upsertProjectSubscription(project.id, {
          tier: resolvedTier,
          status: "active",
          stripeCustomerId: transaction.customerId ?? undefined,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }
    } else {
      // No subscription ID yet — just upsert with what we have
      await upsertProjectSubscription(project.id, {
        tier: resolvedTier,
        status: "active",
        stripeCustomerId: transaction.customerId ?? undefined,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    const { effectiveTier } = await getEffectiveSubscription(project.id);
    res.json({
      success: true,
      data: {
        activated: true,
        tier: effectiveTier as SubscriptionTier,
        transactionStatus: txStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});
