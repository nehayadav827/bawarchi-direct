import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { partyOrders, menuItems, outlets } from "@/db/schema";
import { validateParty, PARTY_MIN_GUESTS, PARTY_MAX_GUESTS, PARTY_MIN_NOTICE_HOURS } from "@/domain/party";
import { istClock } from "@/domain/time";
import { formatINR } from "@/domain/money";
import { HttpError } from "./errors";
import { notify } from "./notify";
import type { SessionUser } from "./auth";

export const partySchema = z.object({
  outletId: z.string().min(1),
  eventAt: z.string().datetime({ offset: true }),
  guests: z.number().int(),
  lines: z.array(z.object({ itemId: z.string().min(1), qty: z.number().int().min(1).max(200) })).max(20).default([]),
  notes: z.string().trim().max(500).optional(),
});

export const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("CONFIRMED"), quotedPaise: z.number().int().min(100).max(100_000_000), note: z.string().trim().max(300).optional() }),
  z.object({ decision: z.literal("DECLINED"), note: z.string().trim().min(1, "Give the customer a reason").max(300) }),
]);

export const PARTY_RULES = { minNoticeHours: PARTY_MIN_NOTICE_HOURS, minGuests: PARTY_MIN_GUESTS, maxGuests: PARTY_MAX_GUESTS };

export async function createPartyOrder(db: Db, user: SessionUser, raw: unknown, now = new Date()) {
  if (user.role !== "customer") throw new HttpError(403, "FORBIDDEN", "Only customers can request a party order");
  const p = partySchema.safeParse(raw);
  if (!p.success) throw new HttpError(422, "INVALID_INPUT", p.error.issues[0]?.message ?? "Invalid request");
  const eventAt = new Date(p.data.eventAt);
  const check = validateParty(eventAt, now, p.data.guests);
  if (!check.ok) {
    const msg = check.reason === "NOTICE" ? `Party orders need at least ${PARTY_MIN_NOTICE_HOURS} hours notice` : check.reason === "GUESTS" ? `Guests must be between ${PARTY_MIN_GUESTS} and ${PARTY_MAX_GUESTS}` : "Choose a date in the future";
    throw new HttpError(422, `PARTY_${check.reason}`, msg);
  }
  const [outlet] = await db.select().from(outlets).where(and(eq(outlets.id, p.data.outletId), eq(outlets.active, true)));
  if (!outlet) throw new HttpError(404, "OUTLET_NOT_FOUND");
  const ids = [...new Set(p.data.lines.map((l) => l.itemId))];
  const items = ids.length ? await db.select().from(menuItems).where(and(inArray(menuItems.id, ids), eq(menuItems.active, true))) : [];
  const lines = p.data.lines.map((l) => {
    const m = items.find((i) => i.id === l.itemId);
    if (!m) throw new HttpError(422, "ITEM_NOT_FOUND", "An item is no longer on the menu");
    const unit = m.portions.length ? Math.max(...m.portions.map((x) => x.pricePaise)) : m.basePaise; // largest pack for party sizes
    return { itemId: m.id, name: m.name, qty: l.qty, unitPaise: unit };
  });
  const estimatePaise = lines.reduce((n, l) => n + l.unitPaise * l.qty, 0);
  const id = `PTY-${randomUUID().slice(0, 6).toUpperCase()}`;
  await db.insert(partyOrders).values({ id, customerId: user.id, outletId: outlet.id, eventAt, guests: p.data.guests, lines, notes: p.data.notes ?? null, estimatePaise, status: "REQUESTED" });
  await notify(db, user.id, null, `Party request ${id} received. The catering manager at ${outlet.name} will confirm the price and details.`);
  return { id, status: "REQUESTED" as const, estimatePaise };
}

export async function listMyPartyOrders(db: Db, user: SessionUser) {
  return db.select().from(partyOrders).where(eq(partyOrders.customerId, user.id)).orderBy(desc(partyOrders.createdAt)).limit(20);
}

/** Catering manager view: managers see their outlet, admins see the outlet asked for. Kitchen staff do not decide party orders. */
export async function listOutletPartyOrders(db: Db, user: SessionUser, outletId: string) {
  assertCatering(user, outletId);
  return db.select().from(partyOrders).where(eq(partyOrders.outletId, outletId)).orderBy(desc(partyOrders.createdAt)).limit(50);
}

function assertCatering(user: SessionUser, outletId: string) {
  if (user.role !== "manager" && user.role !== "admin") throw new HttpError(403, "FORBIDDEN", "Only the catering manager can do this");
  if (user.role === "manager" && user.outletId !== outletId) throw new HttpError(403, "WRONG_OUTLET", "Not your outlet");
}

export async function decidePartyOrder(db: Db, user: SessionUser, id: string, raw: unknown) {
  const [o] = await db.select().from(partyOrders).where(eq(partyOrders.id, id));
  if (!o) throw new HttpError(404, "PARTY_NOT_FOUND");
  assertCatering(user, o.outletId);
  const d = decisionSchema.safeParse(raw);
  if (!d.success) throw new HttpError(422, "INVALID_INPUT", d.error.issues[0]?.message ?? "Invalid decision");
  const set = d.data.decision === "CONFIRMED"
    ? { status: "CONFIRMED" as const, quotedPaise: d.data.quotedPaise, managerNote: d.data.note ?? null, decidedBy: user.id }
    : { status: "DECLINED" as const, quotedPaise: null, managerNote: d.data.note, decidedBy: user.id };
  const done = await db.update(partyOrders).set(set).where(and(eq(partyOrders.id, id), eq(partyOrders.status, "REQUESTED"))).returning({ id: partyOrders.id });
  if (done.length === 0) throw new HttpError(409, "ALREADY_DECIDED", "This request was already decided");
  await notify(db, o.customerId, null, d.data.decision === "CONFIRMED"
    ? `Party order ${id} is confirmed for ${o.eventAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })} ${istClock(o.eventAt)}. Quoted price ${formatINR(d.data.quotedPaise)}.`
    : `Party order ${id} could not be accepted: ${d.data.note}`);
  return { id, status: set.status };
}
