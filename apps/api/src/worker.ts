import * as Sentry from "@sentry/node";
import { closePool } from "@megaeth-verify/db";
import { startReverificationWorkers } from "./jobs/reverify.js";
import { closeRedis } from "./services/redis.js";
import { logger } from "./services/logger.js";

if (process.env["SENTRY_DSN"]) {
  Sentry.init({
    dsn: process.env["SENTRY_DSN"],
    environment: process.env["NODE_ENV"] ?? "development",
  });
}

async function main() {
  const workers = await startReverificationWorkers();
  logger.info("Reverification worker started");

  async function shutdown() {
    logger.info("Shutting down reverification worker...");

    await Promise.all([
      workers.sweepWorker.close(),
      workers.memberWorker.close(),
      workers.purgeWorker.close(),
      workers.sweepQueue.close(),
      workers.memberQueue.close(),
      workers.purgeQueue.close(),
    ]);

    await Promise.all([closePool(), closeRedis()]);
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (err) => {
  logger.error({ err }, "Worker failed to start");
  if (process.env["SENTRY_DSN"]) {
    Sentry.captureException(err);
  }
  await Promise.allSettled([closePool(), closeRedis()]);
  process.exit(1);
});
