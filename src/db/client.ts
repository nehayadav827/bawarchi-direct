import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<any, typeof schema>;
export interface DbHandle { db: Db; close: () => Promise<void> }

const MIGRATIONS = "./drizzle";
// Order references look like WEB-778200. Sequence starts above the brief's sample ids.
const SEQ = sql`CREATE SEQUENCE IF NOT EXISTS order_ref_seq START 778200`;

/** In-memory (or file-backed) Postgres via PGlite: zero setup for tests and local runs. */
export async function createPgliteDb(dataDir?: string): Promise<DbHandle> {
  if (dataDir) mkdirSync(dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  await db.execute(SEQ);
  return { db: db as unknown as Db, close: () => client.close() };
}

export async function createPgDb(url: string): Promise<DbHandle> {
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzlePg(pool, { schema });
  await migratePg(db, { migrationsFolder: MIGRATIONS });
  await db.execute(SEQ);
  return { db: db as unknown as Db, close: () => pool.end() };
}

const g = globalThis as unknown as { __bdDb?: Promise<DbHandle> };

/**
 * App singleton (kept on globalThis so dev hot-reload does not open a second database).
 * DATABASE_URL -> Postgres, otherwise local PGlite in .data/ (dev and demo only).
 * Demo data is seeded outside production, or when SEED_DEMO=true. The seed is idempotent.
 */
export function getDb(): Promise<Db> {
  g.__bdDb ??= (async () => {
    const h = process.env.DATABASE_URL ? await createPgDb(process.env.DATABASE_URL) : await createPgliteDb(".data/pglite");
    if (process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "true") {
      const { seedDb } = await import("./seed");
      await seedDb(h.db);
    }
    return h;
  })();
  g.__bdDb.catch(() => { g.__bdDb = undefined; }); // do not cache a failed start-up; the next request retries
  return g.__bdDb.then((h) => h.db);
}
