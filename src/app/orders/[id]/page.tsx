"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api, istTime } from "@/ui/api";
import { formatINR } from "@/domain/money";
import type { OrderView } from "@/ui/useOrderStream";

const STEPS = [["PLACED", "Received"], ["PREPARING", "Preparing"], ["READY", "Ready"], ["HANDED_OFF", "On its way"]] as const;

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [o, setO] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setO(await api<OrderView>(`/api/orders/${id}`)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load order"); }
  }, [id]);
  useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);

  async function cancel() {
    if (!confirm("Cancel this order?")) return;
    setCancelErr(null);
    try { await api(`/api/orders/${id}/cancel`, { method: "POST", body: {} }); await load(); }
    catch (e) { setCancelErr(e instanceof Error ? e.message : "Could not cancel"); }
  }

  if (error && !o) return <main className="wrap"><div className="notice" role="alert">{error} <Link href="/login?next=/orders">Sign in</Link></div></main>;
  if (!o) return <main className="wrap"><div className="skeleton" style={{ height: 220 }} /></main>;

  const idx = STEPS.findIndex(([s]) => s === o.status);
  const left = Math.round((new Date(o.promisedAt).getTime() - now) / 60000);
  const open = o.status === "PLACED" || o.status === "PREPARING";
  return (
    <main className="wrap stack" style={{ maxWidth: 560 }}>
      <p className="small muted">Order {o.id}</p>
      {o.status === "CANCELLED" ? <h1>Order cancelled</h1> : (
        <>
          <h1>{o.status === "READY" ? "Your order is ready" : o.status === "HANDED_OFF" ? "Handed to the delivery rider" : open ? `Ready by ${istTime(o.promisedAt)}` : ""}</h1>
          {open && left > 0 && <p className="big" aria-live="polite">{left} min</p>}
          <div className="steps" aria-label="Order progress">{STEPS.map(([s, label], i) => <div key={s} className={`step ${i < idx ? "done" : i === idx ? "now" : ""}`}>{label}</div>)}</div>
        </>
      )}
      {o.status === "CANCELLED" && <p className="muted">{o.cancelReason ?? "The outlet could not prepare this order."} Any payment will be refunded.</p>}
      {open && o.lateness.state === "LATE" && <div className="notice" role="status">Running {o.lateness.minutesLate} min behind our promise. The kitchen is on it.</div>}
      {open && o.lateness.state === "ALERT" && <div className="notice" role="status" style={{ borderLeft: "5px solid var(--late)" }}>We&rsquo;re sorry, this is taking longer than promised ({o.lateness.minutesLate} min late). The outlet manager has been alerted.</div>}
      {open && o.promiseSource === "override" && <p className="small muted">The outlet updated your time.</p>}
      <section className="card"><div className="lines">
        {o.items.map((i) => <div key={i.id} className="row between"><span>{i.qty} × {i.name}{i.portion ? ` (${i.portion})` : ""}{i.addOns.length ? ` + ${i.addOns.join(", ")}` : ""}</span></div>)}
      </div><div className="totals"><div className="row between grand"><span>Paid</span><span>{formatINR(o.totalPaise)}</span></div><p className="small muted">Includes 5% GST ({formatINR(o.gstPaise)}).</p></div></section>
      {o.status === "PLACED" && <div><button className="btn ghost" onClick={cancel}>Cancel order</button>{cancelErr && <p className="error small" role="alert">{cancelErr}</p>}</div>}
      {o.status !== "CANCELLED" && o.pointsEarned > 0 && <p className="small muted">You earned {o.pointsEarned} points on this order.</p>}
      {o.messages && o.messages.length > 0 && (
        <section className="stack" aria-label="Messages">
          <h3>Messages sent to you <span className="tag">simulated WhatsApp</span></h3>
          {o.messages.map((m) => <div key={m.id} className="card small" style={{ padding: 12 }}><span className="muted">{istTime(m.createdAt)}</span><br />{m.message}</div>)}
        </section>
      )}
      <Link className="btn ghost" href="/">Order again</Link>
    </main>
  );
}
