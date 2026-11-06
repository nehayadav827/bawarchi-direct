import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";
import type { Db } from "./client";
import { users, outlets, menuItems, cityPrices, coupons, orders, orderItems, orderEvents } from "./schema";
import { OUTLETS, MENU, SAMPLE_COUPONS, SAMPLE_ORDERS } from "@/data/seed-data";

/** Demo-only password for fictional accounts. Documented in deployment.md. */
export const DEMO_PASSWORD = "Demo@1234";
export const DEMO_CUSTOMER_ID = "u-customer";

/** Offsets (minutes from now) so the demo looks live: one on time, one ready, one 4 minutes late (assumption). */
const SAMPLE_TIMING: Record<string, { placed: number; promised: number }> = {
  "WEB-778120": { placed: -12, promised: 33 },
  "WEB-778131": { placed: -18, promised: 22 },
  "WEB-778146": { placed: -54, promised: -4 },
};

export async function seedDb(db: Db, now = new Date()): Promise<void> {
  const existing = (await db.select({ n: count() }).from(outlets))[0];
  if ((existing?.n ?? 0) > 0) return; // idempotent
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const at = (m: number) => new Date(now.getTime() + m * 60000);

  await db.insert(outlets).values(OUTLETS.map((o) => ({ ...o })));
  await db.insert(menuItems).values(MENU.map((m) => ({
    id: m.slug, name: m.name, category: m.category, description: m.description, veg: m.veg, spice: m.spice,
    allergens: m.allergens, prepMinutes: m.prepMinutes, basePaise: m.pricePaise,
    portions: m.portions ?? [], addOns: m.addOns ?? [],
    windowFrom: m.window?.from ?? null, windowTo: m.window?.to ?? null, imageUrl: `/food/${m.slug}.svg`,
  })));
  // One city-price override to exercise the CMS path (assumption: Hyderabad only).
  await db.insert(cityPrices).values({ itemId: "irani-chai", city: "Hyderabad", pricePaise: 5000 });
  await db.insert(coupons).values(SAMPLE_COUPONS.map((c) => ({ ...c })));

  await db.insert(users).values([
    { id: DEMO_CUSTOMER_ID, email: "customer@demo.test", name: "Demo Customer", passwordHash: hash, role: "customer", outletId: null, marketingOptIn: false },
    { id: "u-admin", email: "admin@demo.test", name: "Demo Admin", passwordHash: hash, role: "admin", outletId: null, marketingOptIn: false },
    ...OUTLETS.flatMap((o) => [
      { id: `u-kitchen-${o.id}`, email: `kitchen.${o.id}@demo.test`, name: `${o.name} kitchen`, passwordHash: hash, role: "kitchen" as const, outletId: o.id, marketingOptIn: false },
      { id: `u-manager-${o.id}`, email: `manager.${o.id}@demo.test`, name: `${o.name} manager`, passwordHash: hash, role: "manager" as const, outletId: o.id, marketingOptIn: false },
    ]),
  ]);

  for (const so of SAMPLE_ORDERS) {
    const t = SAMPLE_TIMING[so.ref]!;
    await db.insert(orders).values({
      id: so.ref, outletId: so.outletId, customerId: DEMO_CUSTOMER_ID, status: so.status,
      subtotalPaise: so.totalPaise, discountPaise: 0, totalPaise: so.totalPaise,
      gstPaise: Math.round((so.totalPaise * 5) / 105), paymentMethod: so.payment, paymentRef: `seed-${so.ref}`,
      placedAt: at(t.placed), promisedAt: at(t.promised), estimateMinutes: t.promised - t.placed, promiseSource: "model",
    });
    for (const [slug, portion, qty] of so.items) {
      const m = MENU.find((x) => x.slug === slug)!;
      const unit = portion ? m.portions!.find((p) => p.label === portion)!.pricePaise : m.pricePaise;
      await db.insert(orderItems).values({ orderId: so.ref, itemId: slug, name: m.name, portion, addOns: [], unitPaise: unit, qty, prepMinutes: m.prepMinutes });
    }
    await db.insert(orderEvents).values({ outletId: so.outletId, orderId: so.ref, type: "ORDER_PLACED", payload: {} });
  }
}
