import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createPgliteDb, type DbHandle } from "@/db/client";
import { seedDb } from "@/db/seed";
import { listAdminMenu, updateMenuItem } from "@/server/admin-menu";
import { getMenuForOutlet } from "@/server/menu";
import { HttpError } from "@/server/errors";
import type { SessionUser } from "@/server/auth";

let h: DbHandle;
const admin: SessionUser = { id: "a", name: "A", role: "admin", outletId: null };
const kitchen: SessionUser = { id: "k", name: "K", role: "kitchen", outletId: "kondapur" };
const noon = new Date("2026-11-03T06:30:00Z"); // 12:00 IST
const code = async (p: Promise<unknown>) => { try { await p; return "ok"; } catch (e) { if (e instanceof HttpError) return e.code; throw e; } };

beforeAll(async () => { h = await createPgliteDb(); await seedDb(h.db, noon); }, 30000);
afterAll(async () => { await h.close(); });

describe("menu admin", () => {
  it("is admin only", async () => {
    expect(await code(listAdminMenu(h.db, kitchen))).toBe("FORBIDDEN");
    expect(await code(listAdminMenu(h.db, null))).toBe("UNAUTHENTICATED");
    expect(await code(updateMenuItem(h.db, kitchen, "veg-biryani", { basePaise: 1000 }))).toBe("FORBIDDEN");
  });
  it("validates changes", async () => {
    expect(await code(updateMenuItem(h.db, admin, "veg-biryani", { basePaise: -5 }))).toBe("INVALID_INPUT");
    expect(await code(updateMenuItem(h.db, admin, "veg-biryani", { isAdmin: true }))).toBe("INVALID_INPUT"); // unknown keys rejected
    expect(await code(updateMenuItem(h.db, admin, "veg-biryani", { window: { from: "25:00", to: "10:00" } }))).toBe("INVALID_INPUT");
    expect(await code(updateMenuItem(h.db, admin, "nope", { active: false }))).toBe("ITEM_NOT_FOUND");
  });
  it("price, city override, window and hiding flow through to the customer menu", async () => {
    await updateMenuItem(h.db, admin, "veg-biryani", { basePaise: 27500 });
    await updateMenuItem(h.db, admin, "egg-biryani", { cityPrice: { city: "Hyderabad", pricePaise: 25900 } });
    await updateMenuItem(h.db, admin, "chicken-65", { window: { from: "18:00", to: "23:00" } });
    await updateMenuItem(h.db, admin, "bagara-baingan", { active: false });
    const { items } = await getMenuForOutlet(h.db, "kondapur", noon);
    const by = (id: string) => items.find((i) => i.id === id);
    expect(by("veg-biryani")?.pricePaise).toBe(27500);
    expect(by("egg-biryani")?.pricePaise).toBe(25900);
    expect(by("chicken-65")?.unavailable).toBe("OUTSIDE_HOURS");
    expect(by("bagara-baingan")).toBeUndefined();
    await updateMenuItem(h.db, admin, "chicken-65", { window: null });
    expect((await getMenuForOutlet(h.db, "kondapur", noon)).items.find((i) => i.id === "chicken-65")?.unavailable).toBeNull();
  });
});
