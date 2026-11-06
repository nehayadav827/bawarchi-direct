import { describe, it, expect } from "vitest";
import { count } from "drizzle-orm";
import { createPgliteDb } from "@/db/client";
import { seedDb } from "@/db/seed";
import { outlets, menuItems, orders, users } from "@/db/schema";

describe("db migrate + seed (PGlite)", () => {
  it("migrates, seeds, and is idempotent", async () => {
    const { db, close } = await createPgliteDb();
    await seedDb(db);
    await seedDb(db); // second run is a no-op
    const n = async (t: typeof outlets | typeof menuItems | typeof orders | typeof users) =>
      (await db.select({ n: count() }).from(t))[0]!.n;
    expect(await n(outlets)).toBe(4);
    expect(await n(menuItems)).toBe(12);
    expect(await n(orders)).toBe(3);
    expect(await n(users)).toBe(2 + 8);
    await close();
  }, 30000);
});
