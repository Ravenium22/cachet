import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return url;
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected database pool error:", err);
    });
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export type Database = ReturnType<typeof getDb>;

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
