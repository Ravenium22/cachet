import express, { Router } from "express";
import crypto from "crypto";
import {
  REDIS_PREFIX,
  PADDLE_WEBHOOK_IDEMPOTENCY_TTL_SECONDS,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "@megaeth-verify/shared";
import { AppError } from "../middleware/errorHandler.js";
import {
  findProjectIdByPaddleCustomerId,
  findSubscriptionByPaddleSubscriptionId,
  markPaymentFailedWithGrace,
  upsertProjectSubscription,
} from "../services/subscription.js";
import {
  getPaddleWebhookSecret,
  getTierFromPaddlePriceId,
} from "../services/paddle.js";
import { getRedis } from "../services/redis.js";
import { logger } from "../services/logger.js";

export const webhooksRouter = Router();

// Paddle subscription status to our internal status
function toPaddleSubscriptionStatus(status: string): SubscriptionStatus {
  if (status === "active" || status === "trialing") {
    return "active";
  }
  if (status === "past_due") {
    return "past_due";
  }
  return "cancelled";
}

// Paddle webhook event types
interface PaddleWebhookEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  notification_id: string;
  data: Record<string, unknown>;
}

interface PaddleSubscriptionData {
  id: string;
  status: string;
  customer_id: string;
  items: Array<{
    price: {
      id: string;
    };
    quantity: number;
  }>;
  custom_data?: {
    projectId?: string;
    tier?: string;
  };
  current_billing_period?: {
    ends_at: string;
  };
  scheduled_change?: {
    action: string;
    effective_at: string;
  } | null;
}

interface PaddleTransactionData {
  id: string;
  status: string;
  customer_id: string;
  subscription_id?: string;
  items: Array<{
    price: {
      id: string;
    };
    quantity: number;
  }>;
  custom_data?: {
    projectId?: string;
    tier?: string;
  };
}

async function resolveProjectIdFromPaddleSubscription(
  subscriptionData: PaddleSubscriptionData,
): Promise<string | null> {
  // First try custom_data
  if (subscriptionData.custom_data?.projectId) {
    return subscriptionData.custom_data.projectId;
  }

  // Then try finding by subscription ID
  const bySubscription = await findSubscriptionByPaddleSubscriptionId(subscriptionData.id);
  if (bySubscription) {
    return bySubscription.projectId;
  }

  // Finally try by customer ID
  return findProjectIdByPaddleCustomerId(subscriptionData.customer_id);
}

function resolveTierFromPaddleSubscription(
  subscriptionData: PaddleSubscriptionData,
  fallbackTier?: SubscriptionTier,
): SubscriptionTier {
  // First try price ID mapping
  const priceId = subscriptionData.items[0]?.price?.id;
  const tierFromPrice = getTierFromPaddlePriceId(priceId);
  if (tierFromPrice) {
    return tierFromPrice;
  }

  // Then try custom_data tier
  const metadataTier = subscriptionData.custom_data?.tier;
  if (
    metadataTier === "free" ||
    metadataTier === "growth" ||
    metadataTier === "pro" ||
    metadataTier === "enterprise"
  ) {
    return metadataTier;
  }

  // Use fallback if provided
  if (fallbackTier) {
    logger.warn(
      { paddleSubscriptionId: subscriptionData.id, priceId },
      "Unknown Paddle price ID; preserving existing tier",
    );
    return fallbackTier;
  }

  return "free";
}

function verifyPaddleWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  // Paddle uses ts;h1= format for signature
  const parts = signature.split(";");
  const tsMatch = parts.find(p => p.startsWith("ts="));
  const h1Match = parts.find(p => p.startsWith("h1="));

  if (!tsMatch || !h1Match) {
    return false;
  }

  const timestamp = tsMatch.replace("ts=", "");
  const providedHash = h1Match.replace("h1=", "");

  // Build signed payload
  const signedPayload = `${timestamp}:${rawBody.toString("utf-8")}`;

  // Compute expected signature
  const expectedHash = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // timingSafeEqual throws if buffer lengths differ — guard against that.
  const providedBuf = Buffer.from(providedHash);
  const expectedBuf = Buffer.from(expectedHash);
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

webhooksRouter.post(
  "/paddle",
  express.raw({ type: "application/json" }),
  async (req, res, next) => {
    try {
      const signature = req.headers["paddle-signature"];
      if (!signature || Array.isArray(signature)) {
        throw new AppError(400, "Missing Paddle signature");
      }

      const secret = getPaddleWebhookSecret();
      const isValid = verifyPaddleWebhookSignature(
        req.body as Buffer,
        signature,
        secret,
      );

      if (!isValid) {
        throw new AppError(400, "Invalid Paddle signature");
      }

      const event = JSON.parse((req.body as Buffer).toString("utf-8")) as PaddleWebhookEvent;

      const redis = getRedis();
      const eventKey = `${REDIS_PREFIX.PADDLE_EVENT}${event.event_id}`;
      const acquired = await redis.set(
        eventKey,
        "processing",
        "EX",
        PADDLE_WEBHOOK_IDEMPOTENCY_TTL_SECONDS,
        "NX",
      );

      if (acquired !== "OK") {
        res.json({ received: true, duplicate: true });
        return;
      }

      try {
        switch (event.event_type) {
          case "subscription.created":
          case "subscription.activated": {
            const subscriptionData = event.data as unknown as PaddleSubscriptionData;
            const projectId = await resolveProjectIdFromPaddleSubscription(subscriptionData);
            if (!projectId) {
              logger.warn(
                { paddleSubscriptionId: subscriptionData.id },
                "Could not resolve project ID from subscription",
              );
              break;
            }

            const tier = resolveTierFromPaddleSubscription(subscriptionData);
            const periodEnd = subscriptionData.current_billing_period?.ends_at
              ? new Date(subscriptionData.current_billing_period.ends_at)
              : new Date();

            await upsertProjectSubscription(projectId, {
              tier,
              status: toPaddleSubscriptionStatus(subscriptionData.status),
              stripeCustomerId: subscriptionData.customer_id, // Re-using field for Paddle
              stripeSubscriptionId: subscriptionData.id, // Re-using field for Paddle
              currentPeriodEnd: periodEnd,
            });
            break;
          }

          case "subscription.updated": {
            const subscriptionData = event.data as unknown as PaddleSubscriptionData;
            const projectId = await resolveProjectIdFromPaddleSubscription(subscriptionData);
            if (!projectId) {
              break;
            }

            const existing = await findSubscriptionByPaddleSubscriptionId(subscriptionData.id);
            const tier = resolveTierFromPaddleSubscription(subscriptionData, existing?.tier ?? undefined);
            const periodEnd = subscriptionData.current_billing_period?.ends_at
              ? new Date(subscriptionData.current_billing_period.ends_at)
              : new Date();

            await upsertProjectSubscription(projectId, {
              tier,
              status: toPaddleSubscriptionStatus(subscriptionData.status),
              stripeCustomerId: subscriptionData.customer_id,
              stripeSubscriptionId: subscriptionData.id,
              currentPeriodEnd: periodEnd,
            });
            break;
          }

          case "subscription.canceled": {
            const subscriptionData = event.data as unknown as PaddleSubscriptionData;
            const projectId = await resolveProjectIdFromPaddleSubscription(subscriptionData);
            if (!projectId) {
              break;
            }

            await upsertProjectSubscription(projectId, {
              tier: "free",
              status: "cancelled",
              stripeCustomerId: subscriptionData.customer_id,
              stripeSubscriptionId: subscriptionData.id,
              currentPeriodEnd: new Date(),
            });
            break;
          }

          case "subscription.past_due": {
            const subscriptionData = event.data as unknown as PaddleSubscriptionData;
            const projectId = await resolveProjectIdFromPaddleSubscription(subscriptionData);

            if (projectId) {
              await markPaymentFailedWithGrace(
                projectId,
                subscriptionData.customer_id,
                subscriptionData.id,
              );
            } else {
              logger.warn(
                { paddleSubscriptionId: subscriptionData.id },
                "Payment failure webhook could not be mapped to a project",
              );
            }
            break;
          }

          case "transaction.completed": {
            // Handle successful transaction (one-time or first subscription payment)
            const transactionData = event.data as unknown as PaddleTransactionData;
            const projectId = transactionData.custom_data?.projectId;
            
            if (!projectId || !transactionData.subscription_id) {
              break;
            }

            const tier = transactionData.custom_data?.tier as SubscriptionTier | undefined;
            if (tier && ["growth", "pro", "enterprise"].includes(tier)) {
              await upsertProjectSubscription(projectId, {
                tier,
                status: "active",
                stripeCustomerId: transactionData.customer_id,
                stripeSubscriptionId: transactionData.subscription_id,
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days placeholder
              });
            }
            break;
          }

          default:
            logger.debug({ eventType: event.event_type }, "Unhandled Paddle webhook event");
            break;
        }

        await redis.set(
          eventKey,
          "processed",
          "EX",
          PADDLE_WEBHOOK_IDEMPOTENCY_TTL_SECONDS,
        );
      } catch (processErr) {
        await redis.del(eventKey);
        throw processErr;
      }

      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },
);
