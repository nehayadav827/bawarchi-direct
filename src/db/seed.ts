import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";
import type { Db } from "./client";
import { users, outlets, menuItems, cityPrices, coupons, orders, orderItems, orderEvents, loyaltyLedger, partyOrders } from "./schema";
import { earnPoints } from "@/domain/loyalty";
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
    ...[2, 3, 4, 5, 6].map((n) => ({ id: `u-customer-${n}`, email: `customer${n}@demo.test`, name: `Demo Customer ${n}`, passwordHash: hash, role: "customer" as const, outletId: null, marketingOptIn: n % 2 === 0 })),
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
      pointsEarned: earnPoints(so.totalPaise), readyAt: so.status === "READY" ? at(t.placed + 15) : null,
    });
    await db.insert(loyaltyLedger).values({ userId: DEMO_CUSTOMER_ID, orderId: so.ref, kind: "EARN", points: earnPoints(so.totalPaise) });
    for (const [slug, portion, qty] of so.items) {
      const m = MENU.find((x) => x.slug === slug)!;
      const unit = portion ? m.portions!.find((p) => p.label === portion)!.pricePaise : m.pricePaise;
      await db.insert(orderItems).values({ orderId: so.ref, itemId: slug, name: m.name, portion, addOns: [], unitPaise: unit, qty, prepMinutes: m.prepMinutes });
    }
    await db.insert(orderEvents).values({ outletId: so.outletId, orderId: so.ref, type: "ORDER_PLACED", payload: {} });
  }

  await seedHistory(db, now);
  await db.insert(partyOrders).values([
    { id: "PTY-DEMO01", customerId: DEMO_CUSTOMER_ID, outletId: "kondapur", eventAt: new Date(now.getTime() + 6 * 86400000), guests: 40,
      lines: [{ itemId: "chicken-dum-biryani", name: "Chicken dum biryani", qty: 8, unitPaise: 94000 }], notes: "Family function, lunch at 1 pm. Less spicy please.",
      estimatePaise: 8 * 94000, status: "REQUESTED" },
    { id: "PTY-DEMO02", customerId: "u-customer-2", outletId: "kondapur", eventAt: new Date(now.getTime() + 9 * 86400000), guests: 25,
      lines: [{ itemId: "veg-biryani", name: "Veg biryani", qty: 5, unitPaise: 79900 }], notes: null,
      estimatePaise: 5 * 79900, status: "CONFIRMED", quotedPaise: 385000, managerNote: "Includes raita and dessert.", decidedBy: "u-manager-kondapur" },
  ]);
}

/** About a week of fictional completed orders so the dashboard and "order again" are not empty (assumption A13). */
async function seedHistory(db: Db, now: Date) {
  let seed = 42;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const customers = [DEMO_CUSTOMER_ID, "u-customer-2", "u-customer-3", "u-customer-4", "u-customer-5", "u-customer-6"];
  for (let i = 0; i < 48; i++) {
    const outlet = OUTLETS[Math.floor(rnd() * OUTLETS.length)]!;
    const customerId = i % 3 === 0 ? DEMO_CUSTOMER_ID : customers[Math.floor(rnd() * customers.length)]!;
    const placed = new Date(now.getTime() - (1 + rnd() * 6) * 86400000);
    const picks = Array.from({ length: 1 + Math.floor(rnd() * 2) }, () => MENU[Math.floor(rnd() * MENU.length)]!);
    const lines = picks.map((m) => ({ m, qty: 1 + Math.floor(rnd() * 2), portion: m.portions?.[0]?.label ?? null, unit: m.portions?.[0]?.pricePaise ?? m.pricePaise }));
    const total = lines.reduce((n, l) => n + l.unit * l.qty, 0);
    const slowest = Math.max(...lines.map((l) => l.m.prepMinutes));
    const promisedMin = Math.max(outlet.minPrepMinutes, slowest + Math.floor(rnd() * 10));
    const actualMin = slowest + Math.floor(rnd() * 20);
    const cancelled = rnd() < 0.08;
    const id = `WEB-77${String(7000 + i)}`;
    await db.insert(orders).values({
      id, outletId: outlet.id, customerId, status: cancelled ? "CANCELLED" : "HANDED_OFF", subtotalPaise: total, totalPaise: total, gstPaise: Math.round((total * 5) / 105),
      paymentMethod: rnd() < 0.7 ? "UPI" : "CARD", paymentRef: `seed-${id}`, placedAt: placed, promisedAt: new Date(placed.getTime() + promisedMin * 60000),
      estimateMinutes: promisedMin, promiseSource: "model", readyAt: cancelled ? null : new Date(placed.getTime() + actualMin * 60000),
      pointsEarned: cancelled ? 0 : earnPoints(total), cancelReason: cancelled ? "Cancelled by customer" : null,
    });
    await db.insert(orderItems).values(lines.map((l) => ({ orderId: id, itemId: l.m.slug, name: l.m.name, portion: l.portion, addOns: [], unitPaise: l.unit, qty: l.qty, prepMinutes: l.m.prepMinutes })));
    if (!cancelled) await db.insert(loyaltyLedger).values({ userId: customerId, orderId: id, kind: "EARN", points: earnPoints(total), createdAt: placed });
  }
}
