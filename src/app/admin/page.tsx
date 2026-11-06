"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/ui/api";
import { VegMark } from "@/ui/VegMark";

interface Item { id: string; name: string; veg: boolean; category: string; basePaise: number; active: boolean; windowFrom: string | null; windowTo: string | null; cityPrices: { city: string; pricePaise: number }[] }
const CITY = "Hyderabad";
const rupees = (p: number) => String(p / 100);

function Row({ item, onSaved }: { item: Item; onSaved: () => void }) {
  const city = item.cityPrices.find((c) => c.city === CITY);
  const [base, setBase] = useState(rupees(item.basePaise));
  const [cityP, setCityP] = useState(city ? rupees(city.pricePaise) : "");
  const [from, setFrom] = useState(item.windowFrom ?? "");
  const [to, setTo] = useState(item.windowTo ?? "");
  const [active, setActive] = useState(item.active);
  const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");

  async function save() {
    setState("saving");
    const toPaise = (v: string) => Math.round(Number(v) * 100);
    try {
      await api(`/api/admin/menu/${item.id}`, { method: "PATCH", body: {
        basePaise: toPaise(base), active, window: from && to ? { from, to } : null,
        cityPrice: { city: CITY, pricePaise: cityP.trim() ? toPaise(cityP) : null },
      } });
      setState("saved"); onSaved();
    } catch (e) { setState(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <tr>
      <td><span className="row"><VegMark veg={item.veg} /><b>{item.name}</b></span><div className="small muted">{item.category}</div></td>
      <td><input className="input" aria-label={`${item.name} base price in rupees`} inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} /></td>
      <td><input className="input" aria-label={`${item.name} ${CITY} price`} inputMode="decimal" placeholder="base" value={cityP} onChange={(e) => setCityP(e.target.value)} /></td>
      <td><div className="row"><input className="input" style={{ maxWidth: 90 }} aria-label={`${item.name} available from`} placeholder="HH:MM" value={from} onChange={(e) => setFrom(e.target.value)} /><input className="input" style={{ maxWidth: 90 }} aria-label={`${item.name} available until`} placeholder="HH:MM" value={to} onChange={(e) => setTo(e.target.value)} /></div></td>
      <td><input type="checkbox" aria-label={`${item.name} on menu`} checked={active} onChange={(e) => setActive(e.target.checked)} /></td>
      <td><button className="btn sm" onClick={save} disabled={state === "saving"}>Save</button>
        {state === "saved" && <span className="small" style={{ color: "var(--ok)" }}> Saved</span>}
        {state !== "idle" && state !== "saving" && state !== "saved" && <div className="error small" role="alert">{state}</div>}</td>
    </tr>
  );
}

export default function Admin() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const load = useCallback(() => api<{ items: Item[] }>("/api/admin/menu").then((r) => setItems(r.items)).catch((e) => setError({ status: e.status, message: e.message })), []);
  useEffect(() => { void load(); }, [load]);
  return (
    <main className="wrap stack" style={{ maxWidth: 960 }}>
      <h1>Central menu</h1>
      <p className="muted small">One menu for every outlet. Prices in ₹, GST-inclusive. City price overrides the base price for that city. Leave the time window empty for all-day items.</p>
      {error && <div className="notice" role="alert">{error.message} {error.status !== 403 && <Link href="/login?next=/admin">Sign in as admin</Link>}</div>}
      {!items && !error && <div className="skeleton" style={{ height: 240 }} />}
      {items && <div className="card scroll-x"><table className="admin">
        <thead><tr><th>Item</th><th>Base ₹</th><th>{CITY} ₹</th><th>Available (IST)</th><th>On menu</th><th /></tr></thead>
        <tbody>{items.map((i) => <Row key={i.id} item={i} onSaved={load} />)}</tbody>
      </table></div>}
    </main>
  );
}
