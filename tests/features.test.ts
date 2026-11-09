import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createPgliteDb, type DbHandle } from "@/db/client";
import { seedDb, DEMO_CUSTOMER_ID } from "@/db/seed";
import { createOrder, transitionOrder, cancelOwnOrder, quoteOrder, getOrder } from "@/server/orders";
import { loyaltyBalance } from "@/server/loyalty";
import { suggestReorders } from "@/server/suggestions";
import { createPartyOrder, decidePartyOrder, listOutletPartyOrders } from "@/server/party";
import { outletStats } from "@/server/stats";
import { setOutletItemAvailability } from "@/server/menu";
import { HttpError } from "@/server/errors";
import type { SessionUser } from "@/server/auth";

let h: DbHandle;
const now = new Date("2026-11-03T08:30:00Z"); // Tuesday 14:00 IST
const customer: SessionUser = { id: DEMO_CUSTOMER_ID, name: "C", role: "customer", outletId: null };
const stranger: SessionUser = { id: "u-nobody", name: "N", role: "customer", outletId: null };
const kitchen: SessionUser = { id: "k", name: "K", role: "kitchen", outletId: "kondapur" };
const manager = (o: string): SessionUser => ({ id: `m-${o}`, name: "M", role: "manager", outletId: o });
const admin: SessionUser = { id: "a", name: "A", role: "admin", outletId: null };
const upi = { method: "UPI" as const, vpa: "neha@okbank" };
const code = async (p: Promise<unknown>) => { try { await p; return "ok"; } catch (e) { if (e instanceof HttpError) return e.code; throw e; } };
const order = (extra: object = {}, u = customer) => createOrder(h.db, u, { outletId: "kondapur", payment: upi, lines: [{ itemId: "chicken-dum-biryani", qty: 2, portion: "Regular" }], ...extra }, now);

beforeAll(async () => { h = await createPgliteDb(); await seedDb(h.db, now); }, 30000);
afterAll(async () => { await h.close(); });

describe("loyalty points", () => {
  it("earns 1 point per ₹10 paid", async () => {
    const before = await loyaltyBalance(h.db, customer.id);
    const r = await order();
    expect(r.pointsEarned).toBe(Math.floor(r.totalPaise / 1000));
    expect(await loyaltyBalance(h.db, customer.id)).toBe(before + r.pointsEarned);
  });
  it("redeems at checkout, up to 20%, and rejects too many or more than the balance", async () => {
    const q = await quoteOrder(h.db, customer, { outletId: "kondapur", lines: [{ itemId: "chicken-dum-biryani", qty: 2, portion: "Regular" }], redeemPoints: 0 }, now);
    expect(q.maxRedeemPoints).toBe(Math.floor((q.subtotalPaise * 0.2) / 50));
    const before = await loyaltyBalance(h.db, customer.id);
    const r = await order({ redeemPoints: 100 });
    expect(r.totalPaise).toBe(69800 - 5000);
    expect(await loyaltyBalance(h.db, customer.id)).toBe(before - 100 + r.pointsEarned);
    expect(await code(order({ redeemPoints: 5000 }))).toBe("LOYALTY_INVALID");
    expect(await code(order({ redeemPoints: 50 }, stranger))).toBe("LOYALTY_INVALID"); // stranger has no points
  });
  it("cancelling returns redeemed points and removes earned ones", async () => {
    const start = await loyaltyBalance(h.db, customer.id);
    const r = await order({ redeemPoints: 40 });
    expect(await loyaltyBalance(h.db, customer.id)).toBe(start - 40 + r.pointsEarned);
    await cancelOwnOrder(h.db, customer, r.id);
    expect(await loyaltyBalance(h.db, customer.id)).toBe(start);
  });
});

describe("customer cancellation and messages", () => {
  it("customer can cancel only their own, only before cooking starts", async () => {
    const r = await order();
    expect(await code(cancelOwnOrder(h.db, stranger, r.id))).toBe("ORDER_NOT_FOUND");
    await transitionOrder(h.db, kitchen, r.id, "PREPARING");
    expect(await code(cancelOwnOrder(h.db, customer, r.id))).toBe("TOO_LATE");
  });
  it("kitchen cancel also reverses points", async () => {
    const start = await loyaltyBalance(h.db, customer.id);
    const r = await order();
    await transitionOrder(h.db, kitchen, r.id, "CANCELLED", "Out of chicken");
    expect(await loyaltyBalance(h.db, customer.id)).toBe(start);
  });
  it("records simulated WhatsApp messages the customer can read", async () => {
    const r = await order();
    await transitionOrder(h.db, kitchen, r.id, "PREPARING");
    await transitionOrder(h.db, kitchen, r.id, "READY");
    const o = await getOrder(h.db, customer, r.id, now);
    expect(o.messages.map((m) => m.message).join(" ")).toMatch(/received.*ready.*waiting for the delivery rider/s);
    expect(o.readyAt).not.toBeNull();
  });
});

describe("order again suggestions", () => {
  it("suggests the customer's usual items and nothing for a new customer", async () => {
    const s = await suggestReorders(h.db, customer, "kondapur", now);
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(4);
    expect(s[0]!.timesOrdered).toBeGreaterThanOrEqual(s[s.length - 1]!.timesOrdered);
    expect(await suggestReorders(h.db, stranger, "kondapur", now)).toEqual([]);
    expect(await suggestReorders(h.db, kitchen, "kondapur", now)).toEqual([]);
  });
  it("leaves out items the outlet has paused", async () => {
    const top = (await suggestReorders(h.db, customer, "kondapur", now))[0]!;
    await setOutletItemAvailability(h.db, "kondapur", top.itemId, false);
    expect((await suggestReorders(h.db, customer, "kondapur", now)).some((x) => x.itemId === top.itemId)).toBe(false);
    await setOutletItemAvailability(h.db, "kondapur", top.itemId, true);
  });
});

describe("party orders", () => {
  const evt = (hours: number) => new Date(now.getTime() + hours * 3600_000).toISOString();
  const base = { outletId: "kondapur", guests: 30, lines: [{ itemId: "veg-biryani", qty: 6 }], notes: "Birthday" };
  it("enforces notice and guest limits", async () => {
    expect(await code(createPartyOrder(h.db, customer, { ...base, eventAt: evt(24) }, now))).toBe("PARTY_NOTICE");
    expect(await code(createPartyOrder(h.db, customer, { ...base, eventAt: evt(72), guests: 3 }, now))).toBe("PARTY_GUESTS");
    expect(await code(createPartyOrder(h.db, kitchen, { ...base, eventAt: evt(72) }, now))).toBe("FORBIDDEN");
    expect(await code(createPartyOrder(h.db, customer, { ...base, eventAt: evt(72), lines: [{ itemId: "nope", qty: 1 }] }, now))).toBe("ITEM_NOT_FOUND");
  });
  it("is confirmed or declined by the outlet's catering manager only, once", async () => {
    const r = await createPartyOrder(h.db, customer, { ...base, eventAt: evt(72) }, now);
    expect(r.estimatePaise).toBe(6 * 79900);
    expect(await code(decidePartyOrder(h.db, kitchen, r.id, { decision: "CONFIRMED", quotedPaise: 400000 }))).toBe("FORBIDDEN");
    expect(await code(decidePartyOrder(h.db, manager("kukatpally"), r.id, { decision: "CONFIRMED", quotedPaise: 400000 }))).toBe("WRONG_OUTLET");
    expect(await code(decidePartyOrder(h.db, manager("kondapur"), r.id, { decision: "DECLINED" }))).toBe("INVALID_INPUT"); // reason required
    expect(await code(decidePartyOrder(h.db, manager("kondapur"), r.id, { decision: "CONFIRMED", quotedPaise: 470000, note: "Includes raita" }))).toBe("ok");
    expect(await code(decidePartyOrder(h.db, manager("kondapur"), r.id, { decision: "DECLINED", note: "x" }))).toBe("ALREADY_DECIDED");
    const mine = await listOutletPartyOrders(h.db, manager("kondapur"), "kondapur");
    expect(mine.find((p) => p.id === r.id)?.quotedPaise).toBe(470000);
    expect(await code(listOutletPartyOrders(h.db, kitchen, "kondapur"))).toBe("FORBIDDEN");
  });
});

describe("dashboard", () => {
  it("shows every outlet to admins and only their own to managers; staff and customers are blocked", async () => {
    expect((await outletStats(h.db, admin, 7, now)).length).toBe(4);
    const m = await outletStats(h.db, manager("kondapur"), 7, now);
    expect(m.map((x) => x.outletId)).toEqual(["kondapur"]);
    expect(await code(outletStats(h.db, kitchen, 7, now))).toBe("FORBIDDEN");
    expect(await code(outletStats(h.db, customer, 7, now))).toBe("FORBIDDEN");
    expect(await code(outletStats(h.db, admin, 3, now))).toBe("INVALID_INPUT");
  });
  it("computes sensible numbers", async () => {
    const rows = await outletStats(h.db, admin, 30, now);
    const total = rows.reduce((n, r) => n + r.orders, 0);
    expect(total).toBeGreaterThan(30);
    for (const r of rows) {
      expect(r.cancelRatePct).toBeGreaterThanOrEqual(0);
      expect(r.cancelRatePct).toBeLessThanOrEqual(100);
      expect(r.repeatCustomers).toBeLessThanOrEqual(r.customers);
      if (r.avgPrepMinutes !== null) expect(r.avgPrepMinutes).toBeGreaterThan(0);
      if (r.onTimePct !== null) expect(r.onTimePct).toBeLessThanOrEqual(100);
    }
  });
});
