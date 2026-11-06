"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/ui/api";
import { VegMark } from "@/ui/VegMark";

interface Row { id: string; name: string; veg: boolean; category: string; unavailable: "OUT_OF_STOCK" | "OUTSIDE_HOURS" | null }

export default function Stock({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = use(params);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<{ items: Row[] }>(`/api/kitchen/${outletId}/stock`).then((r) => setRows(r.items)).catch((e) => setError(e.message)), [outletId]);
  useEffect(() => { void load(); }, [load]);
  async function toggle(r: Row) {
    setError(null);
    try { await api(`/api/kitchen/${outletId}/stock`, { body: { itemId: r.id, available: r.unavailable === "OUT_OF_STOCK" } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update"); }
  }
  return (
    <main className="wrap stack" style={{ maxWidth: 560 }}>
      <Link href={`/kitchen/${outletId}`} className="small">← Back to orders</Link>
      <h1>Out of stock</h1>
      <p className="muted small">Paused items disappear from ordering at this outlet immediately.</p>
      {error && <div className="notice" role="alert">{error}</div>}
      {!rows && !error && <div className="skeleton" style={{ height: 200 }} />}
      {rows?.map((r) => (
        <div key={r.id} className="card row between" style={{ padding: 14 }}>
          <span className="row"><VegMark veg={r.veg} /><b>{r.name}</b></span>
          <button className={`btn sm ${r.unavailable === "OUT_OF_STOCK" ? "" : "ghost"}`} onClick={() => toggle(r)} aria-pressed={r.unavailable === "OUT_OF_STOCK"}>{r.unavailable === "OUT_OF_STOCK" ? "Paused · Resume" : "Pause"}</button>
        </div>
      ))}
    </main>
  );
}
