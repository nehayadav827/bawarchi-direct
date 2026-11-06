"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { api } from "@/ui/api";
import { formatINR } from "@/domain/money";
import { useCart } from "@/ui/cart";
import { VegMark } from "@/ui/VegMark";
import { ItemSheet, type MenuEntry } from "@/ui/ItemSheet";

interface MenuData { outlet: { id: string; name: string; fssai: string; minPrepMinutes: number }; items: MenuEntry[] }
const ORDER = ["Biryani", "Starters", "Curries", "Breads & Sides", "Desserts", "Beverages"];

export default function MenuPage({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = use(params);
  const { cart, dispatch, count, subtotalPaise } = useCart();
  const [data, setData] = useState<MenuData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<MenuEntry | null>(null);
  const [vegOnly, setVegOnly] = useState(false);

  useEffect(() => { api<MenuData>(`/api/outlets/${outletId}/menu`).then(setData).catch((e) => setError(e.message)); }, [outletId]);

  const groups = useMemo(() => {
    const items = (data?.items ?? []).filter((i) => !vegOnly || i.veg);
    return ORDER.map((c) => ({ c, items: items.filter((i) => i.category === c) })).filter((g) => g.items.length);
  }, [data, vegOnly]);

  function add(item: MenuEntry, c: { portion?: string; addOns: string[]; qty: number; unitPaise: number }) {
    dispatch({ type: "add", outletId, outletName: data!.outlet.name, line: { itemId: item.id, name: item.name, veg: item.veg, ...c } });
    setSheet(null);
  }

  if (error) return <main className="wrap"><div className="notice" role="alert">{error} <Link href="/">Choose another outlet</Link></div></main>;
  if (!data) return <main className="wrap"><div className="menu-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 260 }} />)}</div></main>;

  return (
    <>
      <main className="wrap stack">
        <div className="stack">
          <h1>{data.outlet.name}</h1>
          <p className="small muted">FSSAI licence {data.outlet.fssai} · All prices include 5% GST · <Link href="/">Change outlet</Link></p>
          <label className="row small"><input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} /> Vegetarian only</label>
        </div>
        {cart.outletId && cart.outletId !== outletId && <div className="notice small">Your cart has items from {cart.outletName}. Adding here will start a new cart.</div>}
        <nav className="chips" aria-label="Menu sections">{groups.map((g) => <a key={g.c} className="chip" href={`#${g.c.replace(/\W+/g, "-")}`}>{g.c}</a>)}</nav>
        {groups.length === 0 && <div className="empty">Nothing matches this filter.</div>}
        {groups.map((g) => (
          <section key={g.c} id={g.c.replace(/\W+/g, "-")} className="stack" style={{ scrollMarginTop: 112 }}>
            <h2>{g.c}</h2>
            <div className="menu-grid">
              {g.items.map((i) => {
                const off = i.unavailable;
                const multi = i.portions.length > 0 || i.addOns.length > 0;
                const from = i.portions.length ? Math.min(...i.portions.map((p) => p.pricePaise)) : i.pricePaise;
                return (
                  <article key={i.id} className={`card dish ${off ? "off" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {i.imageUrl && <img src={i.imageUrl} alt={i.name} loading="lazy" width={400} height={300} />}
                    <div className="dish-body">
                      <div className="dish-top"><VegMark veg={i.veg} /><h3>{i.name}</h3></div>
                      <p className="small muted">{i.description}</p>
                      <p className="small muted">{i.spice > 0 && <>Spice {"●".repeat(i.spice)}{"○".repeat(3 - i.spice)} · </>}Allergens: {i.allergens.length ? i.allergens.join(", ") : "none listed"}</p>
                      <div className="row between" style={{ marginTop: "auto" }}>
                        <span className="price">{i.portions.length ? "from " : ""}{formatINR(from)}</span>
                        {off ? <span className="tag">{off === "OUT_OF_STOCK" ? "Out of stock" : `From ${i.windowFrom}`}</span>
                          : <button className="btn sm" onClick={() => (multi ? setSheet(i) : add(i, { addOns: [], qty: 1, unitPaise: i.pricePaise }))} aria-label={`Add ${i.name}`}>{multi ? "Choose" : "Add"}</button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      {count > 0 && cart.outletId === outletId && (
        <div className="cartbar"><div className="cartbar-in">
          <div><b>{count} item{count > 1 ? "s" : ""}</b> · <span className="price">{formatINR(subtotalPaise)}</span><div className="small muted">incl. 5% GST</div></div>
          <Link className="btn" href="/checkout">Checkout</Link>
        </div></div>
      )}
      {sheet && <ItemSheet item={sheet} onClose={() => setSheet(null)} onAdd={(c) => add(sheet, c)} />}
    </>
  );
}
