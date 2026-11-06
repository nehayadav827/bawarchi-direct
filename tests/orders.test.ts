import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createPgliteDb, type DbHandle } from "@/db/client";
import { seedDb, DEMO_CUSTOMER_ID } from "@/db/seed";
import { orders } from "@/db/schema";
import { createOrder, transitionOrder, overridePromise, sweepLateOrders, listEventsSince, getOrder, listKitchenOrders } from "@/server/orders";
import { setOutletItemAvailability, getMenuForOutlet } from "@/server/menu";
import { HttpError } from "@/server/errors";
import type { SessionUser } from "@/server/auth";
import { TEST_DECLINE_CARD } from "@/server/payments";

let h: DbHandle;
const customer: SessionUser = { id: DEMO_CUSTOMER_ID, name: "C", role: "customer", outletId: null };
const other: SessionUser = { id: "someone-else", name: "O", role: "customer", outletId: null };
const kitchen = (outletId: string): SessionUser => ({ id: `k-${outletId}`, name: "K", role: "kitchen", outletId });
const manager = (outletId: string): SessionUser => ({ id: `m-${outletId}`, name: "M", role: "manager", outletId });
const upi = { method: "UPI" as const, vpa: "neha@okbank" };
const tue2pm = new Date("2026-11-03T08:30:00Z"); // Tuesday 14:00 IST
const tue10am = new Date("2026-11-03T04:30:00Z"); // Tuesday 10:00 IST (haleem window closed)

const code = async (p: Promise<unknown>) => { try { await p; return "ok"; } catch (e) { if (e instanceof HttpError) return e.code; throw e; } };

beforeAll(async () => { h = await createPgliteDb(); await seedDb(h.db, tue2pm); }, 30000);
afterAll(async () => { await h.close(); });

describe("createOrder", () => {
  it("recomputes price on the server and promises at least the outlet minimum", async () => {
    const r = await createOrder(h.db, customer, {
      outletId: "kondapur", payment: upi,
      lines: [{ itemId: "chicken-dum-biryani", qty: 1, portion: "Regular", addOns: ["Extra raita"] }, { itemId: "double-ka-meetha", qty: 2 }],
    }, tue2pm);
    expect(r.totalPaise).toBe(34900 + 3000 + 24000);
    expect(r.gstPaise).toBe(Math.round((r.totalPaise * 5) / 105));
    expect(r.id).toMatch(/^WEB-\d+$/);
    expect(r.promiseMinutes).toBeGreaterThanOrEqual(20);
    expect(r.promisedAt.getTime()).toBe(tue2pm.getTime() + r.promiseMinutes * 60000);
  });
  it("rejects bad input, unknown portions and add-ons", async () => {
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: [] }))).toBe("INVALID_INPUT");
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: [{ itemId: "veg-biryani", qty: 1, portion: "Giant" }] }, tue2pm))).toBe("INVALID_PORTION");
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: [{ itemId: "veg-biryani", qty: 1, addOns: ["Gold leaf"] }] }, tue2pm))).toBe("INVALID_ADDON");
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: [{ itemId: "veg-biryani", qty: 99 }] }, tue2pm))).toBe("INVALID_INPUT");
  });
  it("only customers can order", async () => {
    expect(await code(createOrder(h.db, kitchen("kondapur"), { outletId: "kondapur", payment: upi, lines: [{ itemId: "veg-biryani", qty: 1 }] }, tue2pm))).toBe("FORBIDDEN");
  });
  it("blocks items outside their time window and out-of-stock items", async () => {
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: [{ itemId: "mutton-haleem", qty: 1 }] }, tue10am))).toBe("ITEM_UNAVAILABLE");
    await setOutletItemAvailability(h.db, "kukatpally", "egg-biryani", false);
    expect(await code(createOrder(h.db, customer, { outletId: "kukatpally", payment: upi, lines: [{ itemId: "egg-biryani", qty: 1 }] }, tue2pm))).toBe("ITEM_UNAVAILABLE");
    const menu = await getMenuForOutlet(h.db, "kukatpally", tue2pm);
    expect(menu.items.find((i) => i.id === "egg-biryani")?.unavailable).toBe("OUT_OF_STOCK");
    const other = await getMenuForOutlet(h.db, "kondapur", tue2pm); // pause is per outlet
    expect(other.items.find((i) => i.id === "egg-biryani")?.unavailable).toBeNull();
  });
  it("validates coupons, delivery radius and payment, and creates no order on failure", async () => {
    const before = (await h.db.select().from(orders)).length;
    const line = [{ itemId: "veg-biryani", qty: 1 }];
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: line, couponCode: "NOPE" }, tue2pm))).toBe("COUPON_INVALID");
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: line, couponCode: "flat75" }, tue2pm))).toBe("COUPON_MIN_ORDER");
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: line, location: { lat: 17.2, lng: 78.9 } }, tue2pm))).toBe("OUT_OF_RANGE");
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: { method: "CARD", number: TEST_DECLINE_CARD }, lines: line }, tue2pm))).toBe("PAYMENT_FAILED");
    expect(await code(createOrder(h.db, customer, { outletId: "kondapur", payment: { method: "CARD", number: "4111111111111112" }, lines: line }, tue2pm))).toBe("PAYMENT_FAILED");
    expect((await h.db.select().from(orders)).length).toBe(before);
  });
  it("applies a valid coupon", async () => {
    const r = await createOrder(h.db, customer, { outletId: "banjara-hills", payment: upi, couponCode: "direct10", lines: [{ itemId: "mutton-dum-biryani", qty: 2, portion: "Regular" }] }, tue2pm);
    expect(r.totalPaise).toBe(89800 - 8980);
  });
  it("a busier kitchen gets a longer promise", async () => {
    const quiet = await createOrder(h.db, customer, { outletId: "gachibowli-ck", payment: upi, lines: [{ itemId: "chicken-dum-biryani", qty: 1, portion: "Regular" }] }, tue2pm);
    for (let i = 0; i < 6; i++) await createOrder(h.db, customer, { outletId: "gachibowli-ck", payment: upi, lines: [{ itemId: "chicken-dum-biryani", qty: 4, portion: "Regular" }] }, tue2pm);
    const busy = await createOrder(h.db, customer, { outletId: "gachibowli-ck", payment: upi, lines: [{ itemId: "chicken-dum-biryani", qty: 1, portion: "Regular" }] }, tue2pm);
    expect(busy.promiseMinutes).toBeGreaterThan(quiet.promiseMinutes);
  });
});

describe("kitchen flow and access control", () => {
  it("moves an order through the stages and logs events", async () => {
    const o = await createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: [{ itemId: "veg-biryani", qty: 1 }] }, tue2pm);
    const k = kitchen("kondapur");
    await transitionOrder(h.db, k, o.id, "PREPARING");
    await transitionOrder(h.db, k, o.id, "READY");
    await transitionOrder(h.db, k, o.id, "HANDED_OFF");
    const ev = await listEventsSince(h.db, "kondapur", 0);
    expect(ev.filter((e) => e.orderId === o.id).map((e) => e.type)).toEqual(["ORDER_PLACED", "STATUS_CHANGED", "STATUS_CHANGED", "STATUS_CHANGED"]);
  });
  it("rejects illegal transitions with 409", async () => {
    const o = await createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: [{ itemId: "veg-biryani", qty: 1 }] }, tue2pm);
    expect(await code(transitionOrder(h.db, kitchen("kondapur"), o.id, "READY"))).toBe("ILLEGAL_TRANSITION");
  });
  it("keeps staff to their own outlet and customers out", async () => {
    const o = await createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: [{ itemId: "veg-biryani", qty: 1 }] }, tue2pm);
    expect(await code(transitionOrder(h.db, kitchen("kukatpally"), o.id, "PREPARING"))).toBe("WRONG_OUTLET");
    expect(await code(transitionOrder(h.db, customer, o.id, "PREPARING"))).toBe("FORBIDDEN");
    expect(await code(listKitchenOrders(h.db, kitchen("kukatpally"), "kondapur"))).toBe("WRONG_OUTLET");
  });
  it("lets customers read only their own orders", async () => {
    const o = await createOrder(h.db, customer, { outletId: "kondapur", payment: upi, lines: [{ itemId: "veg-biryani", qty: 1 }] }, tue2pm);
    expect((await getOrder(h.db, customer, o.id, tue2pm)).id).toBe(o.id);
    expect(await code(getOrder(h.db, other, o.id))).toBe("ORDER_NOT_FOUND");
  });
  it("only managers can override the promise, and it is logged", async () => {
    const o = await createOrder(h.db, customer, { outletId: "kukatpally", payment: upi, lines: [{ itemId: "chicken-65", qty: 1 }] }, tue2pm);
    expect(await code(overridePromise(h.db, kitchen("kukatpally"), o.id, 60))).toBe("FORBIDDEN");
    expect(await code(overridePromise(h.db, manager("kukatpally"), o.id, 2))).toBe("INVALID_INPUT");
    await overridePromise(h.db, manager("kukatpally"), o.id, 60);
    const [row] = await h.db.select().from(orders).where(eq(orders.id, o.id));
    expect(row!.promiseSource).toBe("override");
    expect(row!.promisedAt.getTime()).toBe(row!.placedAt.getTime() + 60 * 60000);
  });
});

describe("late-order alerts", () => {
  it("alerts once, 10 minutes past the promise, and not for finished orders", async () => {
    const [late] = await h.db.select().from(orders).where(eq(orders.id, "WEB-778146")); // seeded: 4 min late at seed time
    const now9 = new Date(late!.promisedAt.getTime() + 9 * 60000);
    const now10 = new Date(late!.promisedAt.getTime() + 10 * 60000);
    const before = (await listEventsSince(h.db, "kukatpally", 0)).filter((e) => e.type === "LATE_ALERT").length;
    await sweepLateOrders(h.db, now9);
    expect((await listEventsSince(h.db, "kukatpally", 0)).filter((e) => e.type === "LATE_ALERT").length).toBe(before);
    expect(await sweepLateOrders(h.db, now10)).toBeGreaterThanOrEqual(1);
    const afterFirst = (await listEventsSince(h.db, "kukatpally", 0)).filter((e) => e.type === "LATE_ALERT").length;
    expect(afterFirst).toBe(before + 1);
    await sweepLateOrders(h.db, now10); // idempotent
    expect((await listEventsSince(h.db, "kukatpally", 0)).filter((e) => e.type === "LATE_ALERT").length).toBe(afterFirst);
  });
});
