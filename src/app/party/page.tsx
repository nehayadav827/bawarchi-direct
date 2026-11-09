"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/ui/api";
import { formatINR } from "@/domain/money";

interface Outlet { id: string; name: string }
interface Item { id: string; name: string; portions: { label: string; pricePaise: number }[]; pricePaise: number }
interface Party { id: string; outletId: string; eventAt: string; guests: number; status: "REQUESTED" | "CONFIRMED" | "DECLINED"; estimatePaise: number; quotedPaise: number | null; managerNote: string | null; lines: { name: string; qty: number }[] }
interface Rules { minNoticeHours: number; minGuests: number; maxGuests: number }

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const STATUS: Record<Party["status"], string> = { REQUESTED: "Waiting for confirmation", CONFIRMED: "Confirmed", DECLINED: "Declined" };

export default function PartyPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [when, setWhen] = useState("");
  const [guests, setGuests] = useState("20");
  const [notes, setNotes] = useState("");
  const [mine, setMine] = useState<Party[] | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [auth, setAuth] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMine = useCallback(async () => {
    try { const r = await api<{ rules: Rules; orders: Party[] }>("/api/party"); setMine(r.orders); setRules(r.rules); setAuth(true); }
    catch (e) { if ((e as { status?: number }).status === 401) setAuth(false); setMine([]); }
  }, []);
  useEffect(() => { void loadMine(); api<{ outlets: Outlet[] }>("/api/outlets").then((r) => { setOutlets(r.outlets); setOutletId(r.outlets[0]?.id ?? ""); }).catch(() => setErr("Could not load outlets")); }, [loadMine]);
  useEffect(() => { if (outletId) api<{ items: Item[] }>(`/api/outlets/${outletId}/menu`).then((r) => { setItems(r.items); setQty({}); }).catch(() => setItems([])); }, [outletId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setDone(null); setBusy(true);
    try {
      const lines = Object.entries(qty).filter(([, n]) => n > 0).map(([itemId, n]) => ({ itemId, qty: n }));
      const r = await api<{ id: string }>("/api/party", { body: { outletId, eventAt: new Date(when).toISOString(), guests: Number(guests), lines, notes: notes.trim() || undefined } });
      setDone(r.id); setNotes(""); setQty({}); await loadMine();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not send request"); }
    setBusy(false);
  }

  if (!auth) return <main className="wrap"><div className="notice" role="alert">Sign in to plan a party order. <Link href="/login?next=/party">Sign in</Link></div></main>;
  const outletName = (id: string) => outlets.find((o) => o.id === id)?.name ?? id;
  return (
    <main className="wrap stack" style={{ maxWidth: 640 }}>
      <h1>Party orders</h1>
      <p className="muted">Planning for {rules?.minGuests ?? 10} or more guests? Tell us what you need. The catering manager confirms the final price. Please give at least {rules?.minNoticeHours ?? 48} hours notice.</p>
      <form className="stack card" style={{ padding: 16 }} onSubmit={submit}>
        <div className="field"><label htmlFor="o">Outlet</label>
          <select id="o" className="input" value={outletId} onChange={(e) => setOutletId(e.target.value)}>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label htmlFor="w">Date and time</label><input id="w" className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required /></div>
          <div className="field" style={{ width: 120 }}><label htmlFor="g">Guests</label><input id="g" className="input" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} required /></div>
        </div>
        <fieldset style={{ border: 0, padding: 0, display: "grid", gap: 8 }}><legend className="small muted">What would you like? (optional, the largest pack is used for the estimate)</legend>
          {items.map((i) => (
            <div key={i.id} className="row between"><span>{i.name}</span>
              <div className="stepper"><button type="button" aria-label={`Fewer ${i.name}`} onClick={() => setQty({ ...qty, [i.id]: Math.max(0, (qty[i.id] ?? 0) - 1) })}>−</button><b>{qty[i.id] ?? 0}</b><button type="button" aria-label={`More ${i.name}`} onClick={() => setQty({ ...qty, [i.id]: Math.min(200, (qty[i.id] ?? 0) + 1) })}>+</button></div></div>
          ))}
        </fieldset>
        <div className="field"><label htmlFor="n">Notes</label><textarea id="n" className="input" style={{ minHeight: 80, padding: 12 }} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Occasion, spice level, allergies" /></div>
        {err && <p className="error" role="alert">{err}</p>}
        {done && <p role="status" style={{ color: "var(--ok)", fontWeight: 650 }}>Request {done} sent. You will see the manager&rsquo;s answer below.</p>}
        <button className="btn" disabled={busy || !when || !outletId}>{busy ? "Sending…" : "Send request"}</button>
      </form>
      <h2>Your requests</h2>
      {!mine && <div className="skeleton" style={{ height: 100 }} />}
      {mine?.length === 0 && <div className="empty">No party requests yet.</div>}
      {mine?.map((p) => (
        <article key={p.id} className="card" style={{ padding: 16, display: "grid", gap: 6 }}>
          <div className="row between"><b>{p.id}</b><span className={`tag ${p.status === "CONFIRMED" ? "ok" : p.status === "DECLINED" ? "no" : ""}`}>{STATUS[p.status]}</span></div>
          <p className="small muted">{outletName(p.outletId)} · {fmt(p.eventAt)} · {p.guests} guests</p>
          <p className="small">{p.lines.map((l) => `${l.qty}× ${l.name}`).join(", ") || "No items chosen yet"}</p>
          <p className="small">{p.status === "CONFIRMED" && p.quotedPaise ? <>Confirmed price <b>{formatINR(p.quotedPaise)}</b> (incl. 5% GST)</> : <>Estimate {formatINR(p.estimatePaise)} (incl. 5% GST), final price set by the manager</>}</p>
          {p.managerNote && <p className="small muted">Manager: {p.managerNote}</p>}
        </article>
      ))}
    </main>
  );
}
