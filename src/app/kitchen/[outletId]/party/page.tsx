"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/ui/api";
import { formatINR } from "@/domain/money";

interface Party { id: string; eventAt: string; guests: number; status: "REQUESTED" | "CONFIRMED" | "DECLINED"; estimatePaise: number; quotedPaise: number | null; managerNote: string | null; notes: string | null; lines: { name: string; qty: number }[] }
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

function Card({ p, onDone }: { p: Party; onDone: () => void }) {
  const [price, setPrice] = useState(String(Math.round(p.estimatePaise / 100)));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function decide(decision: "CONFIRMED" | "DECLINED") {
    setErr(null);
    try {
      await api(`/api/party/${p.id}/decision`, { body: decision === "CONFIRMED" ? { decision, quotedPaise: Math.round(Number(price) * 100), note: note || undefined } : { decision, note } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); }
  }
  return (
    <article className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
      <div className="row between"><b>{p.id}</b><span className={`tag ${p.status === "CONFIRMED" ? "ok" : p.status === "DECLINED" ? "no" : ""}`}>{p.status.toLowerCase()}</span></div>
      <p className="small">{fmt(p.eventAt)} · {p.guests} guests</p>
      <p className="small">{p.lines.map((l) => `${l.qty}× ${l.name}`).join(", ") || "No items chosen"}</p>
      {p.notes && <p className="small muted">Customer note: {p.notes}</p>}
      {p.status === "REQUESTED" ? (
        <div className="stack">
          <div className="row" style={{ flexWrap: "wrap" }}>
            <div className="field"><label htmlFor={`pr-${p.id}`}>Quoted price ₹ (incl. GST)</label><input id={`pr-${p.id}`} className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div className="field" style={{ flex: 1, minWidth: 180 }}><label htmlFor={`nt-${p.id}`}>Note to customer</label><input id={`nt-${p.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required if declining" /></div>
          </div>
          {err && <p className="error small" role="alert">{err}</p>}
          <div className="row"><button className="btn" onClick={() => decide("CONFIRMED")}>Confirm</button><button className="btn ghost" onClick={() => decide("DECLINED")}>Decline</button></div>
        </div>
      ) : <p className="small">{p.status === "CONFIRMED" && p.quotedPaise ? `Quoted ${formatINR(p.quotedPaise)}. ` : ""}{p.managerNote}</p>}
    </article>
  );
}

export default function KitchenParty({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = use(params);
  const [list, setList] = useState<Party[] | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const load = useCallback(() => api<{ orders: Party[] }>(`/api/kitchen/${outletId}/party`).then((r) => { setList(r.orders); setError(null); }).catch((e) => setError({ status: e.status, message: e.message })), [outletId]);
  useEffect(() => { void load(); }, [load]);
  return (
    <main className="wrap stack" style={{ maxWidth: 640 }}>
      <Link href={`/kitchen/${outletId}`} className="small">← Back to orders</Link>
      <h1>Party order requests</h1>
      {error && <div className="notice" role="alert">{error.message} {error.status === 401 && <Link href={`/login?next=/kitchen/${outletId}/party`}>Sign in</Link>}</div>}
      {!list && !error && <div className="skeleton" style={{ height: 160 }} />}
      {list?.length === 0 && <div className="empty">No party requests for this outlet.</div>}
      {list?.map((p) => <Card key={p.id} p={p} onDone={load} />)}
    </main>
  );
}
