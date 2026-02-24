import { Queue, Worker, type Job } from "bullmq";
import {
  getDb,
  subscriptions,
  eq,
  and,
  lte,
  gte,
} from "@megaeth-verify/db";
import {
  verifyOnChainPayment,
  expireStaleInvoices,
} from "../services/cryptoPayment.js";
import { logger } from "../services/logger.js";

const CRYPTO_VERIFY_QUEUE = "crypto-verify-payment";
const CRYPTO_EXPIRE_QUEUE = "crypto-expire-invoices";
const CRYPTO_RENEWAL_QUEUE = "crypto-renewal-reminders";

const EXPIRE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RENEWAL_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface VerifyPaymentJob {
  invoiceId: string;
}

function getRedisConnection() {
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) throw new Error("REDIS_URL environment variable is required");

  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

export async function startCryptoPaymentWorkers() {
  const connection = getRedisConnection();

  // ── Queues ────────────────────────────────────────────────────────────

  const verifyQueue = new Queue<VerifyPaymentJob>(CRYPTO_VERIFY_QUEUE, { connection });
  const expireQueue = new Queue(CRYPTO_EXPIRE_QUEUE, { connection });
  const renewalQueue = new Queue(CRYPTO_RENEWAL_QUEUE, { connection });

  // Schedule repeating jobs
  await expireQueue.add(
    "expire-stale-invoices",
    {},
    {
      jobId: "expire-stale-invoices",
      repeat: { every: EXPIRE_INTERVAL_MS },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );

  await renewalQueue.add(
    "renewal-reminders",
    {},
    {
      jobId: "renewal-reminders",
      repeat: { every: RENEWAL_INTERVAL_MS },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );

  // ── Workers ───────────────────────────────────────────────────────────

  const verifyWorker = new Worker<VerifyPaymentJob>(
    CRYPTO_VERIFY_QUEUE,
    async (job: Job<VerifyPaymentJob>) => {
      logger.info({ invoiceId: job.data.invoiceId }, "Verifying crypto payment");
      await verifyOnChainPayment(job.data.invoiceId);
    },
    {
      connection,
      concurrency: 3,
    },
  );

  const expireWorker = new Worker(
    CRYPTO_EXPIRE_QUEUE,
    async () => {
      const count = await expireStaleInvoices();
      return { expired: count };
    },
    {
      connection,
      concurrency: 1,
    },
  );

  const renewalWorker = new Worker(
    CRYPTO_RENEWAL_QUEUE,
    async () => {
      const db = getDb();
      const now = new Date();

      // Find subscriptions expiring within 7 days
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const expiring = await db.query.subscriptions.findMany({
        where: and(
          eq(subscriptions.status, "active"),
          lte(subscriptions.currentPeriodEnd, sevenDaysFromNow),
          gte(subscriptions.currentPeriodEnd, now),
        ),
      });

      if (expiring.length > 0) {
        logger.info(
          { count: expiring.length },
          "Found subscriptions nearing expiry (renewal reminder check)",
        );
      }

      return { expiringSoon: expiring.length };
    },
    {
      connection,
      concurrency: 1,
    },
  );

  // ── Error handlers ────────────────────────────────────────────────────

  verifyWorker.on("failed", (job, err) => {
    logger.error({
      jobId: job?.id,
      invoiceId: job?.data.invoiceId,
      error: err.message,
    }, "Crypto verify job failed");
  });

  expireWorker.on("failed", (job, err) => {
    logger.error({
      jobId: job?.id,
      error: err.message,
    }, "Crypto expire job failed");
  });

  renewalWorker.on("failed", (job, err) => {
    logger.error({
      jobId: job?.id,
      error: err.message,
    }, "Crypto renewal reminder job failed");
  });

  return {
    verifyQueue,
    expireQueue,
    renewalQueue,
    verifyWorker,
    expireWorker,
    renewalWorker,
  };
}
