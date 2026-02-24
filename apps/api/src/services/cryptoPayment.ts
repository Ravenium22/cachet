import {
  createPublicClient,
  http,
  defineChain,
  parseAbi,
  decodeEventLog,
  type PublicClient,
  type Address,
  type Hash,
} from "viem";
import {
  getDb,
  cryptoPayments,
  eq,
  and,
  lte,
  sql,
} from "@megaeth-verify/db";
import {
  SUPPORTED_PAYMENT_CHAINS,
  CRYPTO_PAYMENT_INVOICE_TTL_SECONDS,
  TOKEN_DECIMALS,
  BILLING_PLANS,
} from "@megaeth-verify/shared";
import type {
  SubscriptionTier,
  PaymentChain,
  PaymentToken,
  CryptoInvoice,
} from "@megaeth-verify/shared";
import { upsertProjectSubscription } from "./subscription.js";
import { logger } from "./logger.js";

// ── ERC-20 Transfer event ABI ─────────────────────────────────────────────

const ERC20_TRANSFER_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

// ── Lazy chain clients ────────────────────────────────────────────────────

const chainClients = new Map<string, PublicClient>();

function resolveRpcUrl(chain: PaymentChain): string {
  const config = SUPPORTED_PAYMENT_CHAINS[chain];

  // 1. Per-chain override takes priority
  const override = process.env[config.rpcEnvVar];
  if (override) return override;

  // 2. Build from Alchemy API key
  const alchemyKey = process.env["ALCHEMY_API_KEY"];
  if (alchemyKey) {
    return `https://${config.alchemySlug}.g.alchemy.com/v2/${alchemyKey}`;
  }

  throw new Error(
    `No RPC configured for ${chain}. Set ALCHEMY_API_KEY or ${config.rpcEnvVar}.`,
  );
}

function getChainClient(chain: PaymentChain): PublicClient {
  const existing = chainClients.get(chain);
  if (existing) return existing;

  const config = SUPPORTED_PAYMENT_CHAINS[chain];
  const rpcUrl = resolveRpcUrl(chain);

  const viemChain = defineChain({
    id: config.chainId,
    name: config.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const client = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl, {
      retryCount: 3,
      retryDelay: 500,
      timeout: 15_000,
    }),
  }) as PublicClient;

  chainClients.set(chain, client);
  return client;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getRecipientAddress(): string {
  const addr = process.env["CRYPTO_RECIPIENT_WALLET"];
  if (!addr) throw new Error("CRYPTO_RECIPIENT_WALLET env var is required");
  return addr;
}

function usdCentsToTokenUnits(amountUsdCents: number, token: PaymentToken): string {
  const decimals = TOKEN_DECIMALS[token];
  // amountUsdCents = 1499 → $14.99 → 14990000 (6 decimal token units)
  // cents → dollars = / 100, then * 10^decimals
  // Equivalent: amountUsdCents * 10^(decimals - 2)
  const factor = BigInt(10 ** (decimals - 2));
  const baseAmount = BigInt(amountUsdCents) * factor;

  // Add a random micro-suffix (1–9999 smallest units) so every invoice has a
  // unique on-chain amount.  This prevents tx-hash front-running: an attacker
  // cannot reuse someone else's transfer because the amounts won't match.
  // For USDC (6 dec) 9999 units = $0.009999 — negligible.
  // For 18-dec tokens 9999 units ≈ 0.000000000000009999 — invisible.
  const suffix = BigInt(Math.floor(Math.random() * 9999) + 1);

  return (baseAmount + suffix).toString();
}

function getPlanPrice(tier: SubscriptionTier, billingPeriod: "monthly" | "annual"): number {
  const plan = BILLING_PLANS.find((p) => p.tier === tier);
  if (!plan) throw new Error(`Unknown tier: ${tier}`);

  const price = billingPeriod === "annual" ? plan.priceAnnualUsd : plan.priceMonthlyUsd;
  if (price === null || price === 0) throw new Error(`Tier ${tier} is not available for purchase`);

  return Math.round(price * 100); // cents
}

function computePeriodEnd(billingPeriod: "monthly" | "annual"): Date {
  const now = new Date();
  if (billingPeriod === "annual") {
    now.setFullYear(now.getFullYear() + 1);
  } else {
    now.setMonth(now.getMonth() + 1);
  }
  return now;
}

function toInvoiceResponse(row: typeof cryptoPayments.$inferSelect): CryptoInvoice {
  return {
    id: row.id,
    projectId: row.projectId,
    tier: row.tier as SubscriptionTier,
    billingPeriod: row.billingPeriod as "monthly" | "annual",
    amountUsdCents: row.amountUsdCents,
    token: row.token as PaymentToken,
    chain: row.chain as PaymentChain,
    recipientAddress: row.recipientAddress,
    amountToken: row.amountToken,
    txHash: row.txHash,
    senderAddress: row.senderAddress,
    status: row.status as CryptoInvoice["status"],
    periodStart: row.periodStart?.toISOString() ?? null,
    periodEnd: row.periodEnd?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────

export async function createCryptoInvoice(
  projectId: string,
  tier: SubscriptionTier,
  billingPeriod: "monthly" | "annual",
  token: PaymentToken,
  chain: PaymentChain,
): Promise<CryptoInvoice> {
  // Verify token is available on chosen chain
  const chainConfig = SUPPORTED_PAYMENT_CHAINS[chain];
  if (!chainConfig.tokens[token]) {
    throw new Error(`${token.toUpperCase()} is not available on ${chainConfig.name}`);
  }

  const amountUsdCents = getPlanPrice(tier, billingPeriod);
  const amountToken = usdCentsToTokenUnits(amountUsdCents, token);
  const recipientAddress = getRecipientAddress();
  const expiresAt = new Date(Date.now() + CRYPTO_PAYMENT_INVOICE_TTL_SECONDS * 1000);

  const db = getDb();
  const [row] = await db
    .insert(cryptoPayments)
    .values({
      projectId,
      tier,
      billingPeriod,
      amountUsdCents,
      token,
      chain,
      recipientAddress,
      amountToken,
      status: "pending",
      expiresAt,
    })
    .returning();

  return toInvoiceResponse(row);
}

export async function submitTxHash(invoiceId: string, txHash: string): Promise<CryptoInvoice> {
  const db = getDb();
  const invoice = await db.query.cryptoPayments.findFirst({
    where: eq(cryptoPayments.id, invoiceId),
  });

  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "pending") throw new Error(`Invoice is ${invoice.status}, cannot submit tx`);
  if (invoice.expiresAt.getTime() < Date.now()) throw new Error("Invoice has expired");

  let updated;
  try {
    [updated] = await db
      .update(cryptoPayments)
      .set({
        txHash,
        status: "submitted",
        updatedAt: new Date(),
      })
      .where(eq(cryptoPayments.id, invoiceId))
      .returning();
  } catch (err) {
    // Unique constraint on tx_hash — already used
    const message = err instanceof Error ? err.message : "";
    if (message.includes("crypto_payments_tx_hash_unique")) {
      throw new Error("This transaction hash has already been submitted");
    }
    throw err;
  }

  return toInvoiceResponse(updated);
}

export async function verifyOnChainPayment(invoiceId: string): Promise<CryptoInvoice> {
  const db = getDb();
  const invoice = await db.query.cryptoPayments.findFirst({
    where: eq(cryptoPayments.id, invoiceId),
  });

  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "confirmed") return toInvoiceResponse(invoice); // already done
  if (invoice.status === "expired") throw new Error("Invoice has expired");
  if (invoice.status === "failed") throw new Error("Invoice verification already failed");
  if (!invoice.txHash) throw new Error("No tx hash submitted");

  // Update status to verifying
  await db
    .update(cryptoPayments)
    .set({ status: "verifying", updatedAt: new Date() })
    .where(eq(cryptoPayments.id, invoiceId));

  const chain = invoice.chain as PaymentChain;
  const client = getChainClient(chain);
  const chainConfig = SUPPORTED_PAYMENT_CHAINS[chain];

  try {
    // Prevent tx hash replay: check no other invoice (any status) uses this hash
    const existing = await db.query.cryptoPayments.findFirst({
      where: and(
        eq(cryptoPayments.txHash, invoice.txHash),
        sql`${cryptoPayments.id} != ${invoiceId}`,
      ),
    });
    if (existing) {
      throw new Error("Transaction hash already used for another payment");
    }

    const receipt = await client.getTransactionReceipt({
      hash: invoice.txHash as Hash,
    });

    if (receipt.status !== "success") {
      throw new Error("Transaction reverted on-chain");
    }

    // Check confirmations
    const currentBlock = await client.getBlockNumber();
    const confirmations = Number(currentBlock - receipt.blockNumber);
    if (confirmations < chainConfig.confirmations) {
      throw new Error(`Insufficient confirmations: ${confirmations}/${chainConfig.confirmations}`);
    }

    // Anti-replay: tx must be mined AFTER the invoice was created
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const blockTimestamp = Number(block.timestamp) * 1000; // seconds → ms
    const invoiceCreatedAt = invoice.createdAt.getTime();
    // Allow 60s tolerance for block timestamp drift
    if (blockTimestamp < invoiceCreatedAt - 60_000) {
      throw new Error("Transaction was mined before this invoice was created");
    }

    // Parse Transfer events from the receipt logs
    const token = invoice.token as PaymentToken;
    const tokenAddress = chainConfig.tokens[token];
    if (!tokenAddress) {
      throw new Error(`${token.toUpperCase()} is not available on ${chainConfig.name}`);
    }
    const expectedTokenAddress = tokenAddress.toLowerCase();
    const expectedRecipient = invoice.recipientAddress.toLowerCase();
    const expectedAmount = BigInt(invoice.amountToken);

    let transferFound = false;
    let senderAddress: string | null = null;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== expectedTokenAddress) continue;

      try {
        const decoded = decodeEventLog({
          abi: ERC20_TRANSFER_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName !== "Transfer") continue;

        const to = (decoded.args as { to: string }).to.toLowerCase();
        const value = (decoded.args as { value: bigint }).value;
        const from = (decoded.args as { from: string }).from;

        // Exact amount match — reject overpayments to prevent reusing larger txs
        if (to === expectedRecipient && value === expectedAmount) {
          transferFound = true;
          senderAddress = from;
          break;
        }
      } catch {
        // Not a Transfer event, skip
      }
    }

    if (!transferFound) {
      throw new Error("No matching ERC-20 Transfer found — check token, amount, and recipient");
    }

    // Success — confirm the payment
    const now = new Date();
    const periodEnd = computePeriodEnd(invoice.billingPeriod as "monthly" | "annual");

    const [confirmed] = await db
      .update(cryptoPayments)
      .set({
        status: "confirmed",
        senderAddress,
        periodStart: now,
        periodEnd,
        confirmedAt: now,
        updatedAt: now,
      })
      .where(eq(cryptoPayments.id, invoiceId))
      .returning();

    // Activate subscription
    await upsertProjectSubscription(invoice.projectId, {
      tier: invoice.tier as SubscriptionTier,
      status: "active",
      currentPeriodEnd: periodEnd,
    });

    logger.info({
      invoiceId,
      projectId: invoice.projectId,
      tier: invoice.tier,
      chain,
      txHash: invoice.txHash,
    }, "Crypto payment confirmed");

    return toInvoiceResponse(confirmed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";

    // If insufficient confirmations, don't mark as failed — it can be retried
    if (message.includes("Insufficient confirmations")) {
      throw err;
    }

    await db
      .update(cryptoPayments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(cryptoPayments.id, invoiceId));

    logger.error({
      invoiceId,
      error: message,
    }, "Crypto payment verification failed");

    throw err;
  }
}

export async function expireStaleInvoices(): Promise<number> {
  const db = getDb();
  const now = new Date();

  // Expire both "pending" and "submitted" invoices past their TTL
  const result = await db
    .update(cryptoPayments)
    .set({ status: "expired", updatedAt: now })
    .where(and(
      sql`${cryptoPayments.status} IN ('pending', 'submitted')`,
      lte(cryptoPayments.expiresAt, now),
    ))
    .returning({ id: cryptoPayments.id });

  if (result.length > 0) {
    logger.info({ count: result.length }, "Expired stale crypto invoices");
  }

  return result.length;
}

export async function getInvoice(invoiceId: string): Promise<CryptoInvoice | null> {
  const db = getDb();
  const row = await db.query.cryptoPayments.findFirst({
    where: eq(cryptoPayments.id, invoiceId),
  });
  return row ? toInvoiceResponse(row) : null;
}

export async function getInvoicesForProject(projectId: string): Promise<CryptoInvoice[]> {
  const db = getDb();
  const rows = await db.query.cryptoPayments.findMany({
    where: eq(cryptoPayments.projectId, projectId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return rows.map(toInvoiceResponse);
}
