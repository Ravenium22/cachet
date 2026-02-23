import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import type { SubscriptionTier } from "@megaeth-verify/shared";

/** Typed error thrown when a Paddle checkout / transaction call fails. */
export class PaddleCheckoutError extends Error {
  constructor(
    public readonly code: string,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = "PaddleCheckoutError";
  }
}

let paddleClient: Paddle | null = null;

export function getPaddle(): Paddle {
  if (!paddleClient) {
    const apiKey = process.env["PADDLE_API_KEY"];
    if (!apiKey) {
      throw new Error("PADDLE_API_KEY environment variable is not set");
    }

    const environment = process.env["PADDLE_ENVIRONMENT"] === "production" 
      ? Environment.production 
      : Environment.sandbox;
    paddleClient = new Paddle(apiKey, { environment });
  }
  return paddleClient;
}

export function getPaddleWebhookSecret(): string {
  const secret = process.env["PADDLE_WEBHOOK_SECRET"];
  if (!secret) {
    throw new Error("PADDLE_WEBHOOK_SECRET environment variable is not set");
  }
  return secret;
}

const TIER_TO_PRICE_ID: Record<string, SubscriptionTier> = {};

function populatePriceMappings() {
  const growthPriceId = process.env["PADDLE_GROWTH_PRICE_ID"];
  const proPriceId = process.env["PADDLE_PRO_PRICE_ID"];
  const enterprisePriceId = process.env["PADDLE_ENTERPRISE_PRICE_ID"];

  if (growthPriceId) {
    TIER_TO_PRICE_ID[growthPriceId] = "growth";
  }
  if (proPriceId) {
    TIER_TO_PRICE_ID[proPriceId] = "pro";
  }
  if (enterprisePriceId) {
    TIER_TO_PRICE_ID[enterprisePriceId] = "enterprise";
  }
}

export function getPaddlePriceIdForTier(tier: SubscriptionTier): string {
  const envKey = `PADDLE_${tier.toUpperCase()}_PRICE_ID`;
  const priceId = process.env[envKey];
  if (!priceId) {
    throw new PaddleCheckoutError(
      "missing_price_id",
      `No price configured for the ${tier} tier. Please contact support.`,
    );
  }
  return priceId;
}

export function getTierFromPaddlePriceId(priceId: string | undefined | null): SubscriptionTier | null {
  if (!priceId) return null;

  if (Object.keys(TIER_TO_PRICE_ID).length === 0) {
    populatePriceMappings();
  }

  return TIER_TO_PRICE_ID[priceId] ?? null;
}

export interface PaddleTransactionItem {
  price_id: string;
  quantity: number;
}

export interface CreateTransactionOptions {
  customerId?: string;
  projectId: string;
  tier: SubscriptionTier;
  successUrl: string;
  discountId?: string;
}

export async function createPaddleCheckout(options: CreateTransactionOptions): Promise<{
  transactionId: string;
  checkoutUrl: string | null;
}> {
  const paddle = getPaddle();
  const priceId = getPaddlePriceIdForTier(options.tier);

  const transactionData: Parameters<typeof paddle.transactions.create>[0] = {
    items: [
      {
        priceId,
        quantity: 1,
      },
    ],
    customData: {
      projectId: options.projectId,
      tier: options.tier,
    },
    checkout: {
      url: options.successUrl,
    },
  };

  if (options.customerId) {
    transactionData.customerId = options.customerId;
  }

  if (options.discountId) {
    transactionData.discountId = options.discountId;
  }

  let transaction;
  try {
    transaction = await paddle.transactions.create(transactionData);
  } catch (err: unknown) {
    // Re-throw as a PaddleCheckoutError with actionable details
    const paddleErr = err as { code?: string; detail?: string; message?: string };
    const code = paddleErr.code ?? "unknown";
    const detail = paddleErr.detail ?? paddleErr.message ?? "Paddle API request failed";
    throw new PaddleCheckoutError(code, detail);
  }

  return {
    transactionId: transaction.id,
    checkoutUrl: transaction.checkout?.url ?? null,
  };
}

export async function createPaddleCustomer(projectId: string, projectName: string, email?: string): Promise<string> {
  const paddle = getPaddle();

  const customer = await paddle.customers.create({
    email: email ?? `project-${projectId}@usecachet.com`,
    name: projectName,
    customData: {
      projectId,
    },
  });

  return customer.id;
}

export async function getPaddleCustomerPortalSession(customerId: string): Promise<string> {
  // Paddle's customer portal is accessed via a URL that is generated
  // based on the customer ID. The URL pattern is:
  // https://customer-portal.paddle.com/cpl_{customer_portal_deep_link_id}
  // For sandbox: https://sandbox-customer-portal.paddle.com/...
  
  // Since Paddle doesn't have a direct "create portal session" like Stripe,
  // we need to use the customer portal deep link feature
  const environment = process.env["PADDLE_ENVIRONMENT"] === "production" ? "" : "sandbox-";
  
  // Generate a cancellation/update URL for the customer
  // This is typically done through subscription management
  const portalBaseUrl = `https://${environment}customer-portal.paddle.com`;
  
  // For now, we'll use Paddle's subscription management approach
  // The actual portal URL would come from the subscription's management URLs
  return `${portalBaseUrl}?customer_id=${customerId}`;
}

export async function cancelPaddleSubscription(subscriptionId: string): Promise<void> {
  const paddle = getPaddle();
  await paddle.subscriptions.cancel(subscriptionId, {
    effectiveFrom: "next_billing_period",
  });
}

export async function getPaddleSubscription(subscriptionId: string) {
  const paddle = getPaddle();
  return paddle.subscriptions.get(subscriptionId);
}

export function getPaddleSubscriptionManagementUrls(subscription: Awaited<ReturnType<typeof getPaddleSubscription>>): {
  updatePaymentMethod: string | null;
  cancel: string | null;
} {
  return {
    updatePaymentMethod: subscription.managementUrls?.updatePaymentMethod ?? null,
    cancel: subscription.managementUrls?.cancel ?? null,
  };
}
