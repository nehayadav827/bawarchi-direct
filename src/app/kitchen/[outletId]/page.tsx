"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/ui/api";
import { useUser } from "@/ui/useUser";
import { VegMark } from "@/ui/VegMark";
import type { OrderView } from "@/ui/useOrderStream";

type KOrder = OrderView & { items: (OrderView["items"][number] & { prepMinutes?: number })[] };
interface Data { outlet: { name: string; fssai: string }; orders: KOrder[] }
const COLS = [["PLACED", "New"], ["PREPARING", "Preparing"], ["READY", "Ready for rider"]] as const;
const NEXT = { PLACED: ["PREPARING", "Start cooking"], PREPARING: ["READY", "Mark ready"], READY: ["HANDED_OFF", "Handed to rider"] } as const;

/** Minutes until the promise (negative = late). Computed on the tablet every few seconds so timers never freeze. */
const minsLeft = (o: KOrder, now: number) => Math.ceil((new Date(o.promisedAt).getTime() - now) / 60000);

export default function Kitchen({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = use(params);
  const { user, loading } = useUser();
  const [data, setData] = useState<Data | null>(null);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [edit, setEdit] = useState<{ id: string; v: string } | null>(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    try { setData(await api<Data>(`/api/kitchen/${outletId}/orders`)); setDenied(false); }
    catch (e) { const s = (e as { status?: number }).status; if (s === 401 || s === 403) setDenied(true); else setMsg("Connection problem. Retrying…"); }
  }, [outletId]);

  useEffect(() => {
    void load();
    const poll = setInterval(load, 10000); // fallback if the stream is blocked or dropped
    const clock = setInterval(() => setNow(Date.now()), 5000);
    const es = new EventSource(`/api/kitchen/${outletId}/stream`);
    es.addEventListener("ready", () => { setLive(true); setMsg(null); void load(); });
    es.addEventListener("order", () => void load());
    es.onerror = () => setLive(false); // the browser reconnects on its own and resends Last-Event-ID
    return () => { clearInterval(poll); clearInterval(clock); es.close(); };
  }, [outletId, load]);

  async function act(id: string, to: string, reason?: string) {
    if (busy.current) return; busy.current = true; setMsg(null);
    try { await api(`/api/kitchen/orders/${id}/status`, { body: { to, reason } }); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not update"); }
    busy.current = false; void load();
  }
  async function savePromise() {
    if (!edit) return;
    try { await api(`/api/kitchen/orders/${edit.id}/promise`, { body: { minutes: Number(edit.v) } }); setEdit(null); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not change time"); }
    void load();
  }

  if (denied) return <main className="wrap"><div className="notice" role="alert">Kitchen staff only. <Link href={`/login?next=/kitchen/${outletId}`}>Sign in</Link></div></main>;
  const alerts = (data?.orders ?? []).filter((o) => (o.status === "PLACED" || o.status === "PREPARING") && minsLeft(o, now) <= -10);
  const canOverride = user?.role === "manager" || user?.role === "admin";

  return (
    <div className="kds-root">
      <div className="kds-bar">
        <span>{data?.outlet.name ?? "Kitchen"}</span>
        <span className="live"><span className={`dot ${live ? "" : "off"}`} />{live ? "Live" : "Reconnecting (auto-refresh on)"}</span>
        <span className="spacer" />
        {canOverride && <Link className="link" href={`/kitchen/${outletId}/party`} style={{ color: "#fff", fontSize: "1rem" }}>Party orders</Link>}
        <Link className="link" href={`/kitchen/${outletId}/stock`} style={{ color: "#fff", fontSize: "1rem" }}>Out of stock</Link>
      </div>
      {alerts.map((o) => <div key={o.id} className="kbanner" role="alert">ALERT: {o.id} is {-minsLeft(o, now)} min past its promise{canOverride ? "" : ". Tell the manager"}</div>)}
      {msg && <div className="kbanner" style={{ background: "#7a4b00" }} role="status">{msg}</div>}
      {!data && !loading && <p style={{ padding: 20 }}>Loading orders…</p>}
      {data && data.orders.length === 0 && <p style={{ padding: 24, fontSize: "1.5rem" }}>No open orders. New orders appear here the moment they are placed.</p>}
      <div className="kds-cols">
        {COLS.map(([status, label]) => {
          const list = (data?.orders ?? []).filter((o) => o.status === status);
          return (
            <section key={status} className="kds-col" aria-label={label}>
              <h2><span>{label}</span><span>{list.length}</span></h2>
              {list.map((o) => {
                const m = minsLeft(o, now);
                const cls = status === "READY" ? "" : m <= -10 ? "alert" : m < 0 ? "late" : m <= 5 ? "soon" : "";
                return (
                  <article key={o.id} className={`ticket ${cls}`}>
                    <div className="row between"><span className="id">{o.id}</span>
                      {status !== "READY" && <span className="timer" aria-label="Time to promise">{m < 0 ? `LATE ${-m} MIN` : `${m} min`}</span>}</div>
                    <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
                      {o.items.map((i) => <li key={i.id}>{i.qty} × {i.name} <small>{[i.portion, ...i.addOns].filter(Boolean).join(" · ")}</small></li>)}
                    </ul>
                    {o.promiseSource === "override" && <small style={{ color: "#b9b9b9" }}>Time set by manager</small>}
                    <button className={`kbtn ${status === "READY" ? "go" : ""}`} onClick={() => act(o.id, NEXT[status][0])}>{NEXT[status][1]}</button>
                    <div className="row">
                      {status !== "READY" && <button className="kbtn sec" onClick={() => { if (confirm(`Cancel ${o.id}?`)) void act(o.id, "CANCELLED", "Cancelled by outlet"); }}>Cancel</button>}
                      {canOverride && status !== "READY" && (edit?.id === o.id
                        ? <><input className="input" style={{ maxWidth: 90, color: "#000" }} inputMode="numeric" aria-label="Minutes from order time" value={edit.v} onChange={(e) => setEdit({ id: o.id, v: e.target.value })} /><button className="kbtn sec" onClick={savePromise}>Save</button></>
                        : <button className="kbtn sec" onClick={() => setEdit({ id: o.id, v: String(Math.round((new Date(o.promisedAt).getTime() - new Date(o.placedAt).getTime()) / 60000)) })}>Change time</button>)}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
