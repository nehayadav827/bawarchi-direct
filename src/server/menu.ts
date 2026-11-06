import { eq, and } from "drizzle-orm";
import type { Db } from "@/db/client";
import { menuItems, outlets, cityPrices, outletItems } from "@/db/schema";
import { istParts, inWindow } from "@/domain/time";
import { HttpError } from "./errors";

export type Unavailable = "OUT_OF_STOCK" | "OUTSIDE_HOURS" | null;

export interface MenuEntry {
  id: string; name: string; category: string; description: string; veg: boolean; spice: number; allergens: string[];
  pricePaise: number; portions: { label: string; pricePaise: number }[]; addOns: { label: string; pricePaise: number }[];
  imageUrl: string | null; windowFrom: string | null; windowTo: string | null; unavailable: Unavailable; prepMinutes: number;
}

/** Menu as one outlet's customers see it: city prices, outlet stock pauses and time-based windows applied. */
export async function getMenuForOutlet(db: Db, outletId: string, now = new Date()) {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, outletId));
  if (!outlet || !outlet.active) throw new HttpError(404, "OUTLET_NOT_FOUND");
  const [items, prices, stock] = await Promise.all([
    db.select().from(menuItems).where(eq(menuItems.active, true)),
    db.select().from(cityPrices).where(eq(cityPrices.city, outlet.city)),
    db.select().from(outletItems).where(and(eq(outletItems.outletId, outletId), eq(outletItems.available, false))),
  ]);
  const cityMap = new Map(prices.map((p) => [p.itemId, p.pricePaise]));
  const paused = new Set(stock.map((s) => s.itemId));
  const hhmm = istParts(now).hhmm;
  const entries: MenuEntry[] = items.map((m) => ({
    id: m.id, name: m.name, category: m.category, description: m.description, veg: m.veg, spice: m.spice, allergens: m.allergens,
    pricePaise: cityMap.get(m.id) ?? m.basePaise, portions: m.portions, addOns: m.addOns, imageUrl: m.imageUrl,
    windowFrom: m.windowFrom, windowTo: m.windowTo, prepMinutes: m.prepMinutes,
    unavailable: paused.has(m.id) ? "OUT_OF_STOCK" : inWindow(m.windowFrom, m.windowTo, hhmm) ? null : "OUTSIDE_HOURS",
  }));
  return { outlet, items: entries };
}

/** Outlet staff pause or resume an item (out of stock). */
export async function setOutletItemAvailability(db: Db, outletId: string, itemId: string, available: boolean) {
  await db.insert(outletItems).values({ outletId, itemId, available })
    .onConflictDoUpdate({ target: [outletItems.outletId, outletItems.itemId], set: { available } });
}
