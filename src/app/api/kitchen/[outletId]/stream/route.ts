import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orderEvents } from "@/db/schema";
import { listEventsSince, sweepLateOrders } from "@/server/orders";
import { requireRole } from "@/server/auth";
import { handle, currentUser } from "@/server/http";

export const dynamic = "force-dynamic";
const TICK_MS = 2000;
const HEARTBEAT_MS = 15000;

/**
 * Server-Sent Events for one outlet. The event log in Postgres is the source of truth:
 * the stream only says "something changed" and replays from Last-Event-ID after a reconnect.
 * The client refetches the order list on every event, so a missed event can never lose an order.
 */
export function GET(req: Request, { params }: { params: Promise<{ outletId: string }> }) {
  return handle(async () => {
    const { outletId } = await params;
    requireRole(await currentUser(), ["kitchen", "manager", "admin"], outletId);
    const db = await getDb();
    const header = req.headers.get("last-event-id");
    let last = header !== null && header !== "" ? Number(header) : NaN;
    if (!Number.isFinite(last)) {
      const [row] = await db.select({ id: orderEvents.id }).from(orderEvents).where(eq(orderEvents.outletId, outletId)).orderBy(desc(orderEvents.id)).limit(1);
      last = row?.id ?? 0;
    }
    const enc = new TextEncoder();
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (s: string) => { if (!closed) controller.enqueue(enc.encode(s)); };
        const stop = () => { closed = true; if (timer) clearTimeout(timer); try { controller.close(); } catch { /* already closed */ } };
        req.signal.addEventListener("abort", stop);
        send(`retry: 3000\nevent: ready\ndata: ${JSON.stringify({ last })}\n\n`);
        let sinceBeat = 0;
        const tick = async () => {
          if (closed) return;
          try {
            await sweepLateOrders(db);
            const events = await listEventsSince(db, outletId, last);
            for (const e of events) {
              last = e.id;
              send(`id: ${e.id}\nevent: order\ndata: ${JSON.stringify({ id: e.id, type: e.type, orderId: e.orderId, payload: e.payload })}\n\n`);
            }
            sinceBeat = events.length ? 0 : sinceBeat + TICK_MS;
            if (sinceBeat >= HEARTBEAT_MS) { send(": keep-alive\n\n"); sinceBeat = 0; }
          } catch (err) { console.error("stream tick failed", err); }
          timer = setTimeout(tick, TICK_MS);
        };
        timer = setTimeout(tick, 0);
      },
      cancel() { closed = true; if (timer) clearTimeout(timer); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
  });
}
