import Redis from "ioredis";

function getRedisUrl(): string {
  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("REDIS_URL environment variable is required");
  }
  return url;
}

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        console.log(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      reconnectOnError(err: Error) {
        const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    redis.on("connect", () => {
      console.log("Redis connected");
    });

    redis.on("error", (err: Error) => {
      console.error("Redis error:", err.message);
    });

    redis.on("close", () => {
      console.log("Redis connection closed");
    });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
