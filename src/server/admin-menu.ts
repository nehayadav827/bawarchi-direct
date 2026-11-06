import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { menuItems, cityPrices } from "@/db/schema";
import { requireRole, type SessionUser } from "./auth";
import { HttpError } from "./errors";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
export const updateItemSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().min(1).max(300).optional(),
  basePaise: z.number().int().min(100).max(1_000_000).optional(),
  active: z.boolean().optional(),
  window: z.union([z.object({ from: hhmm, to: hhmm }), z.null()]).optional(),
  cityPrice: z.object({ city: z.string().min(1).max(60), pricePaise: z.number().int().min(100).max(1_000_000).nullable() }).optional(),
}).strict();

export async function listAdminMenu(db: Db, user: SessionUser | null) {
  requireRole(user, ["admin"]);
  const [items, prices] = await Promise.all([db.select().from(menuItems), db.select().from(cityPrices)]);
  return items.map((m) => ({ ...m, cityPrices: prices.filter((p) => p.itemId === m.id).map((p) => ({ city: p.city, pricePaise: p.pricePaise })) }));
}

/** Central CMS edit: price, availability, time window, per-city price override (null clears it). */
export async function updateMenuItem(db: Db, user: SessionUser | null, id: string, raw: unknown) {
  requireRole(user, ["admin"]);
  const p = updateItemSchema.safeParse(raw);
  if (!p.success) throw new HttpError(422, "INVALID_INPUT", p.error.issues[0]?.message ?? "Invalid change");
  const { cityPrice, window, basePaise, ...rest } = p.data;
  const [item] = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.id, id));
  if (!item) throw new HttpError(404, "ITEM_NOT_FOUND");
  const set: Partial<typeof menuItems.$inferInsert> = { ...rest };
  if (basePaise !== undefined) set.basePaise = basePaise;
  if (window !== undefined) { set.windowFrom = window?.from ?? null; set.windowTo = window?.to ?? null; }
  if (Object.keys(set).length) await db.update(menuItems).set(set).where(eq(menuItems.id, id));
  if (cityPrice) {
    if (cityPrice.pricePaise === null) await db.delete(cityPrices).where(and(eq(cityPrices.itemId, id), eq(cityPrices.city, cityPrice.city)));
    else await db.insert(cityPrices).values({ itemId: id, city: cityPrice.city, pricePaise: cityPrice.pricePaise })
      .onConflictDoUpdate({ target: [cityPrices.itemId, cityPrices.city], set: { pricePaise: cityPrice.pricePaise } });
  }
  return { ok: true };
}
