"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/ui/api";
import { formatINR } from "@/domain/money";

interface Row { outletId: string; outletName: string; orders: number; cancelled: number; cancelRatePct: number; revenuePaise: number; avgPrepMinutes: number | null; onTimePct: number | null; customers: number; repeatCustomers: number; repeatPct: number | null }

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  useEffect(() => {
    setRows(null);
    api<{ outlets: Row[] }>(`/api/dashboard?days=${days}`).then((r) => { setRows(r.outlets); setError(null); }).catch((e) => setError({ status: e.status, message: e.message }));
  }, [days]);
  const max = Math.max(1, ...(rows ?? []).map((r) => r.orders));
  const dash = (v: number | null, s = "") => (v === null ? "–" : `${v}${s}`);
  return (
    <main className="wrap stack" style={{ maxWidth: 960 }}>
      <div className="row between" style={{ flexWrap: "wrap" }}>
        <h1>Outlet dashboard</h1>
        <div className="tabs" role="group" aria-label="Time range" style={{ width: 260 }}>
          {[[1, "Today"], [7, "7 days"], [30, "30 days"]].map(([d, l]) => <button key={d} className="tab" aria-pressed={days === d} onClick={() => setDays(d as number)}>{l}</button>)}
        </div>
      </div>
      <p className="muted small">Prep time is from order placed to marked ready. On time means ready by the promised time. Repeat customers ordered at least twice in the period.</p>
      {error && <div className="notice" role="alert">{error.message} {error.status === 401 && <Link href="/login?next=/dashboard">Sign in</Link>}</div>}
      {!rows && !error && <div className="skeleton" style={{ height: 240 }} />}
      {rows && rows.length > 0 && (
        <>
          <div className="stack" aria-label="Orders by outlet">
            {rows.map((r) => (
              <div key={r.outletId} className="row" style={{ gap: 12 }}>
                <span style={{ width: 170 }} className="small">{r.outletName}</span>
                <div style={{ flex: 1, background: "var(--line)", borderRadius: 6, height: 14 }}><div style={{ width: `${(r.orders / max) * 100}%`, background: "var(--brand)", height: "100%", borderRadius: 6 }} /></div>
                <b style={{ width: 40, textAlign: "right" }}>{r.orders}</b>
              </div>
            ))}
          </div>
          <div className="card scroll-x"><table className="admin">
            <thead><tr><th>Outlet</th><th>Orders</th><th>Revenue</th><th>Avg prep</th><th>On time</th><th>Cancelled</th><th>Repeat customers</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.outletId}><td><b>{r.outletName}</b></td><td>{r.orders}</td><td>{formatINR(r.revenuePaise)}</td><td>{dash(r.avgPrepMinutes, " min")}</td><td>{dash(r.onTimePct, "%")}</td>
                <td>{r.cancelled} ({r.cancelRatePct}%)</td><td>{r.repeatCustomers} of {r.customers} ({dash(r.repeatPct, "%")})</td></tr>
            ))}</tbody>
          </table></div>
        </>
      )}
      {rows?.length === 0 && <div className="empty">No data for this period.</div>}
    </main>
  );
}
