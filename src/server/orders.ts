import { z } from "zod";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orders, orderItems, orderEvents, coupons, outlets, users, loyaltyLedger, notifications } from "@/db/schema";
import { computeTotals, applyCoupon, type Coupon } from "@/domain/money";
import { estimatePrep, lateness } from "@/domain/prep-time";
import { assertTransition, IllegalTransitionError, type OrderStatus } from "@/domain/order-state";
import { haversineKm } from "@/domain/geo";
import { istParts, istClock } from "@/domain/time";
import { earnPoints, pointsToPaise, validateRedeem, maxRedeemPoints } from "@/domain/loyalty";
import { getMenuForOutlet } from "./menu";
import { mockPay, paymentSchema } from "./payments";
import { HttpError } from "./errors";
import { notify } from "./notify";
import { loyaltyBalance } from "./loyalty";
import type { SessionUser } from "./auth";

export const MAX_LINES = 30; // bulk and party orders go through the party form, not this checkout
export const MAX_QTY = 20;

export const createOrderSchema = z.object({
  outletId: z.string().min(1),
  lines: z.array(z.object({
    itemId: z.string().min(1),
    qty: z.number().int().min(1).max(MAX_QTY),
    portion: z.string().optional(),
    addOns: z.array(z.string()).max(10).default([]),
  })).min(1).max(MAX_LINES),
  couponCode: z.string().trim().toUpperCase().max(30).optional(),
  redeemPoints: z.number().int().min(0).max(100000).default(0),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  payment: paymentSchema,
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

type PriceInput = Omit<CreateOrderInput, "payment">;

/** Prices a cart from the database: availability, portions, add-ons, coupon and totals. Shared by quote and checkout. */
async function priceCart(db: Db, input: PriceInput, now: Date, userId: string) {
  const { outlet, items } = await getMenuForOutlet(db, input.outletId, now);
  if (input.location && haversineKm(input.location, outlet) > outlet.radiusKm) {
    throw new HttpError(422, "OUT_OF_RANGE", "This outlet does not deliver to your location");
  }

  const priced = input.lines.map((l) => {
    const item = items.find((i) => i.id === l.itemId);
    if (!item) throw new HttpError(422, "ITEM_NOT_FOUND", "An item is no longer on the menu");
    if (item.unavailable) throw new HttpError(409, "ITEM_UNAVAILABLE", `${item.name} is not available right now`);
    let unit = item.pricePaise;
    if (l.portion) {
      const p = item.portions.find((x) => x.label === l.portion);
      if (!p) throw new HttpError(422, "INVALID_PORTION", `Unknown portion for ${item.name}`);
      unit = p.pricePaise;
    }
    let addOnPaise = 0;
    for (const label of l.addOns) {
      const a = item.addOns.find((x) => x.label === label);
      if (!a) throw new HttpError(422, "INVALID_ADDON", `Unknown add-on for ${item.name}`);
      addOnPaise += a.pricePaise;
    }
    return { item, line: l, unit, addOnPaise };
  });

  let coupon: Coupon | null = null;
  if (input.couponCode) {
    const [c] = await db.select().from(coupons).where(and(eq(coupons.code, input.couponCode), eq(coupons.active, true)));
    if (!c) throw new HttpError(422, "COUPON_INVALID", "That coupon code is not valid");
    coupon = c.type === "PERCENT"
      ? { code: c.code, type: "PERCENT", value: c.value, minOrderPaise: c.minOrderPaise ?? undefined, maxDiscountPaise: c.maxDiscountPaise ?? undefined }
      : { code: c.code, type: "FLAT", value: c.value, minOrderPaise: c.minOrderPaise ?? undefined };
  }
  const cartLines = priced.map((p) => ({ unitPaise: p.unit, addOnPaise: p.addOnPaise, qty: p.line.qty }));
  const couponOnly = computeTotals(cartLines, coupon);
  if (coupon) {
    const r = applyCoupon(couponOnly.subtotalPaise, coupon);
    if (!r.ok) throw new HttpError(422, "COUPON_MIN_ORDER", "Order is below the coupon's minimum");
  }
  const balance = await loyaltyBalance(db, userId);
  const payable = couponOnly.subtotalPaise - couponOnly.discountPaise;
  const redeem = validateRedeem(input.redeemPoints, balance, payable);
  if (!redeem.ok) throw new HttpError(422, "LOYALTY_INVALID", redeem.reason === "NOT_ENOUGH" ? "You do not have that many points" : redeem.reason === "TOO_MUCH" ? "Points can cover up to 20% of the order" : "Invalid points");
  const totals = computeTotals(cartLines, coupon, pointsToPaise(input.redeemPoints));
  const loyalty = { balance, redeemPoints: input.redeemPoints, maxRedeemPoints: maxRedeemPoints(balance, payable), pointsEarned: earnPoints(totals.totalPaise) };
  return { outlet, priced, coupon, totals, loyalty };
}

/** Preview totals (coupon applied) before paying. Creates nothing. */
export async function quoteOrder(db: Db, user: SessionUser, raw: unknown, now = new Date()) {
  if (user.role !== "customer") throw new HttpError(403, "FORBIDDEN", "Only customers place orders");
  const parsed = createOrderSchema.omit({ payment: true }).safeParse(raw);
  if (!parsed.success) throw new HttpError(422, "INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid order");
  const { totals, loyalty } = await priceCart(db, parsed.data, now, user.id);
  return { ...totals, ...loyalty };
}

/** Never trust client prices: everything is recomputed from the database. */
export async function createOrder(db: Db, user: SessionUser, raw: unknown, now = new Date()) {
  if (user.role !== "customer") throw new HttpError(403, "FORBIDDEN", "Only customers place orders");
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(422, "INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid order");
  const input = parsed.data;

  const { outlet, priced, coupon, totals, loyalty } = await priceCart(db, input, now, user.id);

  const pay = mockPay(input.payment, totals.totalPaise);
  if (!pay.ok) throw new HttpError(402, "PAYMENT_FAILED", pay.reason === "INVALID_CARD" ? "Card number looks wrong" : "Payment was declined");

  const open = await openLoadUnits(db, outlet.id);
  const t = istParts(now);
  const est = estimatePrep({
    items: priced.map((p) => ({ prepMinutes: p.item.prepMinutes, qty: p.line.qty })),
    openLoadUnits: open, capacityUnits: outlet.capacityUnits, day: t.day, hour: t.hour, outletMinMinutes: outlet.minPrepMinutes,
  });
  const promisedAt = new Date(now.getTime() + est.promisedMinutes * 60000);

  const idRow = (await db.execute(sql`select nextval('order_ref_seq') as n`)).rows[0] as { n: string | number };
  const id = `WEB-${idRow.n}`;
  await db.transaction(async (tx) => {
    // Lock the customer row so two orders at once cannot spend the same points.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for("update");
    if (loyalty.redeemPoints > 0 && (await loyaltyBalance(tx as unknown as Db, user.id)) < loyalty.redeemPoints) {
      throw new HttpError(409, "LOYALTY_CHANGED", "Your points balance changed. Please review your order");
    }
    await tx.insert(orders).values({
      id, outletId: outlet.id, customerId: user.id, status: "PLACED", subtotalPaise: totals.subtotalPaise, discountPaise: totals.discountPaise,
      loyaltyPaise: totals.loyaltyPaise, pointsRedeemed: loyalty.redeemPoints, pointsEarned: loyalty.pointsEarned, totalPaise: totals.totalPaise, gstPaise: totals.gstIncludedPaise, couponCode: coupon?.code ?? null, paymentMethod: input.payment.method,
      paymentRef: pay.ref, placedAt: now, promisedAt, estimateMinutes: est.estimateMinutes, promiseSource: est.source,
    });
    await tx.insert(orderItems).values(priced.map((p) => ({
      orderId: id, itemId: p.item.id, name: p.item.name, portion: p.line.portion ?? null, addOns: p.line.addOns,
      unitPaise: p.unit + p.addOnPaise, qty: p.line.qty, prepMinutes: p.item.prepMinutes,
    })));
    await tx.insert(orderEvents).values({ outletId: outlet.id, orderId: id, type: "ORDER_PLACED", payload: { promisedAt: promisedAt.toISOString() } });
    const ledger = [
      ...(loyalty.redeemPoints > 0 ? [{ userId: user.id, orderId: id, kind: "REDEEM" as const, points: -loyalty.redeemPoints }] : []),
      ...(loyalty.pointsEarned > 0 ? [{ userId: user.id, orderId: id, kind: "EARN" as const, points: loyalty.pointsEarned }] : []),
    ];
    if (ledger.length) await tx.insert(loyaltyLedger).values(ledger);
  });
  await notify(db, user.id, id, `Order ${id} received at ${outlet.name}. We will have it ready by ${istClock(promisedAt)}.`);
  return { id, status: "PLACED" as OrderStatus, pointsEarned: loyalty.pointsEarned, totalPaise: totals.totalPaise, gstPaise: totals.gstIncludedPaise, promisedAt, promiseMinutes: est.promisedMinutes, promiseSource: est.source };
}

export async function openLoadUnits(db: Db, outletId: string): Promise<number> {
  const rows = await db.select({ n: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int` }).from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.outletId, outletId), inArray(orders.status, ["PLACED", "PREPARING"])));
  return rows[0]?.n ?? 0;
}

async function loadOrder(db: Db, id: string) {
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o) throw new HttpError(404, "ORDER_NOT_FOUND");
  return o;
}

function assertStaffOf(user: SessionUser, outletId: string, roles: string[]) {
  if (!roles.includes(user.role)) throw new HttpError(403, "FORBIDDEN", "Not allowed for your role");
  if (user.role !== "admin" && user.outletId !== outletId) throw new HttpError(403, "WRONG_OUTLET", "Not your outlet");
}

type OrderRow = typeof orders.$inferSelect;

const STATUS_MESSAGE: Partial<Record<OrderStatus, (id: string) => string>> = {
  READY: (id) => `Your order ${id} is ready and waiting for the delivery rider.`,
  HANDED_OFF: (id) => `Your order ${id} has been handed to the delivery rider.`,
  CANCELLED: (id) => `Your order ${id} was cancelled. Any payment and points used will be returned.`,
};

/** Shared by kitchen and customer cancellations: compare-and-set, event, ready time, points reversal and message, in one transaction. */
async function moveOrder(db: Db, o: OrderRow, to: OrderStatus, reason?: string) {
  const claimed = await db.transaction(async (tx) => {
    const updated = await tx.update(orders)
      .set({ status: to, cancelReason: to === "CANCELLED" ? (reason ?? null) : null, ...(to === "READY" ? { readyAt: new Date() } : {}) })
      .where(and(eq(orders.id, o.id), eq(orders.status, o.status))).returning({ id: orders.id });
    // Compare-and-set on the old status so two tablets tapping at once cannot both win.
    if (updated.length === 0) return false;
    await tx.insert(orderEvents).values({ outletId: o.outletId, orderId: o.id, type: "STATUS_CHANGED", payload: { from: o.status, to } });
    if (to === "CANCELLED") {
      const back = [
        ...(o.pointsEarned > 0 ? [{ userId: o.customerId, orderId: o.id, kind: "REVERSAL" as const, points: -o.pointsEarned }] : []),
        ...(o.pointsRedeemed > 0 ? [{ userId: o.customerId, orderId: o.id, kind: "RETURN" as const, points: o.pointsRedeemed }] : []),
      ];
      if (back.length) await tx.insert(loyaltyLedger).values(back);
    }
    return true;
  });
  if (!claimed) throw new HttpError(409, "STALE_STATUS", "Order was updated by someone else");
  const msg = STATUS_MESSAGE[to];
  if (msg) await notify(db, o.customerId, o.id, msg(o.id));
  return { id: o.id, status: to };
}

export async function transitionOrder(db: Db, user: SessionUser, orderId: string, to: OrderStatus, reason?: string) {
  const o = await loadOrder(db, orderId);
  assertStaffOf(user, o.outletId, ["kitchen", "manager", "admin"]);
  try { assertTransition(o.status, to); }
  catch (e) { if (e instanceof IllegalTransitionError) throw new HttpError(409, "ILLEGAL_TRANSITION", e.message); throw e; }
  return moveOrder(db, o, to, reason);
}

/** A customer can cancel their own order only while the kitchen has not started it. */
export async function cancelOwnOrder(db: Db, user: SessionUser, orderId: string) {
  const o = await loadOrder(db, orderId);
  if (user.role !== "customer" || o.customerId !== user.id) throw new HttpError(404, "ORDER_NOT_FOUND");
  if (o.status !== "PLACED") throw new HttpError(409, "TOO_LATE", "The kitchen has already started this order");
  return moveOrder(db, o, "CANCELLED", "Cancelled by customer");
}

/** Managers can override the promised time (the AI estimate may be wrong). Logged as an event. */
export async function overridePromise(db: Db, user: SessionUser, orderId: string, minutes: number, now = new Date()) {
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) throw new HttpError(422, "INVALID_INPUT", "Minutes must be 5 to 240");
  const o = await loadOrder(db, orderId);
  assertStaffOf(user, o.outletId, ["manager", "admin"]);
  if (o.status !== "PLACED" && o.status !== "PREPARING") throw new HttpError(409, "ORDER_CLOSED", "Order is no longer being prepared");
  const promisedAt = new Date(o.placedAt.getTime() + minutes * 60000);
  await db.update(orders).set({ promisedAt, promiseSource: "override", alertedAt: null }).where(eq(orders.id, orderId));
  await db.insert(orderEvents).values({ outletId: o.outletId, orderId, type: "PROMISE_UPDATED", payload: { by: user.id, minutes, promisedAt: promisedAt.toISOString() } });
  await notify(db, o.customerId, orderId, `Update for order ${orderId}: it is now expected by ${istClock(promisedAt)}.`);
  return { id: orderId, promisedAt };
}

/** Alerts the outlet manager and the customer once an order is 10 minutes past its promise. Idempotent. */
export async function sweepLateOrders(db: Db, now = new Date()): Promise<number> {
  const open = await db.select().from(orders).where(and(inArray(orders.status, ["PLACED", "PREPARING"]), isNull(orders.alertedAt)));
  let n = 0;
  for (const o of open) {
    const l = lateness(now, o.promisedAt);
    if (l.state !== "ALERT") continue;
    const claimed = await db.update(orders).set({ alertedAt: now }).where(and(eq(orders.id, o.id), isNull(orders.alertedAt))).returning({ id: orders.id });
    if (claimed.length === 0) continue; // another worker claimed it
    await db.insert(orderEvents).values({ outletId: o.outletId, orderId: o.id, type: "LATE_ALERT", payload: { minutesLate: l.minutesLate } });
    await notify(db, o.customerId, o.id, `Sorry, order ${o.id} is running ${l.minutesLate} minutes late. The outlet manager has been alerted.`);
    n++;
  }
  return n;
}

export async function listEventsSince(db: Db, outletId: string, afterId: number, limit = 200) {
  return db.select().from(orderEvents).where(and(eq(orderEvents.outletId, outletId), gt(orderEvents.id, afterId))).orderBy(asc(orderEvents.id)).limit(limit);
}

async function withItems(db: Db, rows: (typeof orders.$inferSelect)[], now: Date) {
  if (rows.length === 0) return [];
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.id)));
  return rows.map((o) => ({ ...o, lateness: lateness(now, o.promisedAt), items: items.filter((i) => i.orderId === o.id) }));
}

export async function listKitchenOrders(db: Db, user: SessionUser, outletId: string, now = new Date()) {
  assertStaffOf(user, outletId, ["kitchen", "manager", "admin"]);
  const rows = await db.select().from(orders).where(and(eq(orders.outletId, outletId), inArray(orders.status, ["PLACED", "PREPARING", "READY"]))).orderBy(asc(orders.promisedAt));
  const [outlet] = await db.select({ name: outlets.name, fssai: outlets.fssai }).from(outlets).where(eq(outlets.id, outletId));
  return { outlet, orders: await withItems(db, rows, now) };
}

/** A customer sees only their own orders. Staff see their outlet's. */
export async function getOrder(db: Db, user: SessionUser, id: string, now = new Date()) {
  const o = await loadOrder(db, id);
  if (user.role === "customer") { if (o.customerId !== user.id) throw new HttpError(404, "ORDER_NOT_FOUND"); }
  else assertStaffOf(user, o.outletId, ["kitchen", "manager", "admin"]);
  const messages = await db.select({ id: notifications.id, channel: notifications.channel, message: notifications.message, createdAt: notifications.createdAt })
    .from(notifications).where(eq(notifications.orderId, id)).orderBy(asc(notifications.id));
  return { ...(await withItems(db, [o], now))[0]!, messages };
}

export async function listMyOrders(db: Db, user: SessionUser, now = new Date()) {
  const rows = await db.select().from(orders).where(eq(orders.customerId, user.id)).orderBy(sql`${orders.placedAt} desc`).limit(20);
  return withItems(db, rows, now);
}
