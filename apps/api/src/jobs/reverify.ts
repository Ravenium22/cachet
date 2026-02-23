import crypto from "node:crypto";
import { Queue, Worker, type Job } from "bullmq";
import {
  getDb,
  projects,
  verifications,
  and,
  eq,
  asc,
  isNull,
  isNotNull,
  lte,
} from "@megaeth-verify/db";
import { REDIS_PREFIX } from "@megaeth-verify/shared";
import { reverifyUser } from "../services/verification.js";
import { logger } from "../services/logger.js";
import { getRedis } from "../services/redis.js";

const REVERIFY_SWEEP_QUEUE = "reverify-project-sweep";
const REVERIFY_MEMBER_QUEUE = "reverify-members";
const PROJECT_PURGE_QUEUE = "project-soft-delete-purge";

const REVERIFY_BATCH_SIZE = 50;
const REVERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface ReverifyMemberJob {
  verificationId: string;
}

function getRedisConnection() {
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is required");
  }

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function utcDayBucket(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function withRedisLock<T>(
  lockKey: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const redis = getRedis();
  const token = crypto.randomUUID();
  const acquired = await redis.set(lockKey, token, "EX", ttlSeconds, "NX");

  if (acquired !== "OK") {
    return null;
  }

  try {
    return await fn();
  } finally {
    await redis.eval(
      `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`,
      1,
      lockKey,
      token,
    );
  }
}

async function enqueueProjectBatchJobs(memberQueue: Queue<ReverifyMemberJob>, projectId: string): Promise<number> {
  const db = getDb();
  const dayBucket = utcDayBucket();

  const verificationRows = await db
    .select({ id: verifications.id })
    .from(verifications)
    .where(and(
      eq(verifications.projectId, projectId),
      eq(verifications.status, "active"),
    ))
    .orderBy(asc(verifications.lastChecked));

  let enqueued = 0;
  const batches = chunk(verificationRows, REVERIFY_BATCH_SIZE);

  for (const batch of batches) {
    for (let i = 0; i < batch.length; i += 1) {
      const verification = batch[i]!;
      const delay = i * 120;

      await memberQueue.add(
        "reverify-member",
        { verificationId: verification.id },
        {
          jobId: `${dayBucket}:${verification.id}`,
          delay,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2_000,
          },
          removeOnComplete: true,
          removeOnFail: 500,
        },
      );

      enqueued += 1;
    }

    await sleep(250);
  }

  return enqueued;
}

async function purgeSoftDeletedProjects(): Promise<number> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);

  const deleted = await db
    .delete(projects)
    .where(and(
      isNotNull(projects.deletedAt),
      lte(projects.deletedAt, cutoff),
    ))
    .returning({ id: projects.id });

  return deleted.length;
}

export async function startReverificationWorkers() {
  const connection = getRedisConnection();

  const sweepQueue = new Queue(REVERIFY_SWEEP_QUEUE, { connection });
  const memberQueue = new Queue<ReverifyMemberJob>(REVERIFY_MEMBER_QUEUE, { connection });
  const purgeQueue = new Queue(PROJECT_PURGE_QUEUE, { connection });

  await sweepQueue.add(
    "daily-project-sweep",
    {},
    {
      jobId: "daily-project-sweep",
      repeat: {
        every: REVERIFY_INTERVAL_MS,
      },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );

  // Trigger one immediate sweep after startup.
  await sweepQueue.add(
    "startup-project-sweep",
    {},
    { jobId: "startup-project-sweep", removeOnComplete: true, removeOnFail: 100 },
  );

  await purgeQueue.add(
    "daily-soft-delete-purge",
    {},
    {
      jobId: "daily-soft-delete-purge",
      repeat: {
        every: PURGE_INTERVAL_MS,
      },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );

  await purgeQueue.add(
    "startup-soft-delete-purge",
    {},
    { jobId: "startup-soft-delete-purge", removeOnComplete: true, removeOnFail: 100 },
  );

  const sweepWorker = new Worker(
    REVERIFY_SWEEP_QUEUE,
    async () => {
      const lockKey = `${REDIS_PREFIX.WORKER_LOCK}reverify-sweep`;
      const result = await withRedisLock(lockKey, 23 * 60 * 60, async () => {
        const db = getDb();
        const activeProjects = await db.query.projects.findMany({
          where: isNull(projects.deletedAt),
          columns: { id: true },
        });

        let totalEnqueued = 0;
        for (const project of activeProjects) {
          const count = await enqueueProjectBatchJobs(memberQueue, project.id);
          totalEnqueued += count;
        }

        return { projects: activeProjects.length, jobsEnqueued: totalEnqueued };
      });

      if (!result) {
        logger.info("Skipped sweep: another worker instance holds the lock");
        return { skipped: true };
      }

      return result;
    },
    {
      connection,
      concurrency: 1,
    },
  );

  const memberWorker = new Worker<ReverifyMemberJob>(
    REVERIFY_MEMBER_QUEUE,
    async (job: Job<ReverifyMemberJob>) => {
      await reverifyUser(job.data.verificationId, "automatic");
      await sleep(120);
    },
    {
      connection,
      concurrency: 2,
    },
  );

  const purgeWorker = new Worker(
    PROJECT_PURGE_QUEUE,
    async () => {
      const lockKey = `${REDIS_PREFIX.WORKER_LOCK}soft-delete-purge`;
      const result = await withRedisLock(lockKey, 60 * 60, async () => {
        const deletedCount = await purgeSoftDeletedProjects();
        return { deletedCount };
      });

      if (!result) {
        logger.info("Skipped purge: another worker instance holds the lock");
        return { skipped: true };
      }

      return result;
    },
    {
      connection,
      concurrency: 1,
    },
  );

  sweepWorker.on("failed", (job, err) => {
    logger.error({
      jobId: job?.id,
      error: err.message,
    }, "Project sweep job failed");
  });

  memberWorker.on("failed", (job, err) => {
    logger.error({
      jobId: job?.id,
      verificationId: job?.data.verificationId,
      error: err.message,
    }, "Member reverify job failed");
  });

  purgeWorker.on("failed", (job, err) => {
    logger.error({
      jobId: job?.id,
      error: err.message,
    }, "Soft-delete purge job failed");
  });

  return {
    sweepQueue,
    memberQueue,
    purgeQueue,
    sweepWorker,
    memberWorker,
    purgeWorker,
  };
}
