import { and, eq, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orders, orderItems } from "@/db/schema";
import { getMenuForOutlet } from "./menu";
import type { SessionUser } from "./auth";

/**
 * "Order again": the customer's most frequent items that this outlet can serve now.
 * It only suggests. Nothing is ever added to the cart without the customer choosing it.
 */
export async function suggestReorders(db: Db, user: SessionUser, outletId: string, now = new Date()) {
  if (user.role !== "customer") return [];
  const rows = await db.select({ itemId: orderItems.itemId, portion: orderItems.portion, n: sql<number>`count(*)::int`, last: sql<Date>`max(${orders.placedAt})` })
    .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.customerId, user.id), ne(orders.status, "CANCELLED")))
    .groupBy(orderItems.itemId, orderItems.portion);
  if (rows.length === 0) return [];
  const { items } = await getMenuForOutlet(db, outletId, now);
  const byItem = new Map<string, { times: number; portion: string | null; best: number; last: number }>();
  for (const r of rows) {
    const cur = byItem.get(r.itemId) ?? { times: 0, portion: null, best: 0, last: 0 };
    cur.times += r.n;
    if (r.n > cur.best) { cur.best = r.n; cur.portion = r.portion; }
    cur.last = Math.max(cur.last, new Date(r.last).getTime());
    byItem.set(r.itemId, cur);
  }
  return [...byItem.entries()]
    .map(([itemId, v]) => ({ itemId, ...v, item: items.find((i) => i.id === itemId) }))
    .filter((x) => x.item && !x.item.unavailable)
    .sort((a, b) => b.times - a.times || b.last - a.last)
    .slice(0, 4)
    .map((x) => ({ itemId: x.itemId, name: x.item!.name, veg: x.item!.veg, portion: x.portion, timesOrdered: x.times }));
}
