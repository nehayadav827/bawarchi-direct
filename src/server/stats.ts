import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { outlets } from "@/db/schema";
import { HttpError } from "./errors";
import type { SessionUser } from "./auth";

export const DASHBOARD_RANGES = [1, 7, 30] as const;

export interface OutletStats {
  outletId: string; outletName: string; orders: number; cancelled: number; cancelRatePct: number; revenuePaise: number;
  avgPrepMinutes: number | null; onTimePct: number | null; customers: number; repeatCustomers: number; repeatPct: number | null;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Orders, actual prep time, cancellations and repeat customers per outlet. Managers see only their outlet. */
export async function outletStats(db: Db, user: SessionUser, days: number, now = new Date()): Promise<OutletStats[]> {
  if (user.role !== "manager" && user.role !== "admin") throw new HttpError(403, "FORBIDDEN", "Managers and admins only");
  if (!DASHBOARD_RANGES.includes(days as 1 | 7 | 30)) throw new HttpError(422, "INVALID_INPUT", "days must be 1, 7 or 30");
  const since = new Date(now.getTime() - days * 86400000);
  const agg = (await db.execute(sql`
    select outlet_id,
      count(*) filter (where status <> 'CANCELLED')::int as orders,
      count(*) filter (where status = 'CANCELLED')::int as cancelled,
      coalesce(sum(total_paise) filter (where status <> 'CANCELLED'), 0)::bigint as revenue,
      round(avg(extract(epoch from (ready_at - placed_at)) / 60) filter (where ready_at is not null))::int as avg_prep,
      count(*) filter (where ready_at is not null)::int as ready_n,
      count(*) filter (where ready_at is not null and ready_at <= promised_at)::int as on_time_n,
      count(distinct customer_id) filter (where status <> 'CANCELLED')::int as customers
    from orders where placed_at >= ${since.toISOString()} group by outlet_id`)).rows as Record<string, unknown>[];
  const rep = (await db.execute(sql`
    select outlet_id, count(*)::int as n from (
      select outlet_id, customer_id from orders where placed_at >= ${since.toISOString()} and status <> 'CANCELLED'
      group by outlet_id, customer_id having count(*) >= 2) t group by outlet_id`)).rows as Record<string, unknown>[];
  const all = await db.select({ id: outlets.id, name: outlets.name }).from(outlets);
  return all.filter((o) => user.role === "admin" || o.id === user.outletId).map((o) => {
    const a = agg.find((r) => r.outlet_id === o.id);
    const orders = num(a?.orders) ?? 0, cancelled = num(a?.cancelled) ?? 0, readyN = num(a?.ready_n) ?? 0;
    const customers = num(a?.customers) ?? 0, repeatCustomers = num(rep.find((r) => r.outlet_id === o.id)?.n) ?? 0;
    return {
      outletId: o.id, outletName: o.name, orders, cancelled,
      cancelRatePct: orders + cancelled ? Math.round((cancelled / (orders + cancelled)) * 100) : 0,
      revenuePaise: num(a?.revenue) ?? 0, avgPrepMinutes: num(a?.avg_prep),
      onTimePct: readyN ? Math.round(((num(a?.on_time_n) ?? 0) / readyN) * 100) : null,
      customers, repeatCustomers, repeatPct: customers ? Math.round((repeatCustomers / customers) * 100) : null,
    };
  });
}
