"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/ui/api";
import { formatINR } from "@/domain/money";
import { useCart } from "@/ui/cart";
import { useUser } from "@/ui/useUser";
import { VegMark } from "@/ui/VegMark";

interface Totals { subtotalPaise: number; discountPaise: number; loyaltyPaise: number; totalPaise: number; gstIncludedPaise: number; balance: number; maxRedeemPoints: number; redeemPoints: number; pointsEarned: number }

export default function Checkout() {
  const router = useRouter();
  const { user, loading } = useUser();
  const { cart, dispatch } = useCart();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<string | undefined>();
  const [redeem, setRedeem] = useState(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [method, setMethod] = useState<"UPI" | "CARD">("UPI");
  const [vpa, setVpa] = useState("");
  const [card, setCard] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lines = cart.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, portion: l.portion, addOns: l.addOns }));
  const sig = JSON.stringify(lines);

  useEffect(() => { if (!loading && !user) router.replace("/login?next=/checkout"); }, [loading, user, router]);
  useEffect(() => {
    if (!user || !cart.outletId) return;
    api<Totals>("/api/orders/quote", { body: { outletId: cart.outletId, lines, couponCode: applied, redeemPoints: redeem } })
      .then((t) => { setTotals(t); setErr(null); })
      .catch((e) => { if (redeem > 0) { setRedeem(0); return; } setErr(e.message); setTotals(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, cart.outletId, sig, applied, redeem]);

  async function applyCoupon() {
    setCouponErr(null);
    try {
      const t = await api<Totals>("/api/orders/quote", { body: { outletId: cart.outletId, lines, couponCode: coupon, redeemPoints: 0 } });
      setApplied(coupon.trim().toUpperCase()); setRedeem(0); setTotals(t);
    } catch (e) { setCouponErr(e instanceof Error ? e.message : "Could not apply coupon"); }
  }

  async function place() {
    setBusy(true); setErr(null);
    try {
      const payment = method === "UPI" ? { method, vpa: vpa.trim() } : { method, number: card.replace(/\s+/g, "") };
      const r = await api<{ id: string }>("/api/orders", { body: { outletId: cart.outletId, lines, couponCode: applied, redeemPoints: redeem, payment } });
      dispatch({ type: "clear" });
      router.push(`/orders/${r.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not place order"); setBusy(false); }
  }

  if (!cart.outletId) return <main className="wrap"><div className="empty">Your cart is empty. <Link href="/">Pick an outlet</Link></div></main>;
  return (
    <main className="wrap stack" style={{ maxWidth: 560 }}>
      <h1>Checkout</h1>
      <p className="muted small">{cart.outletName} · <Link href={`/menu/${cart.outletId}`}>Edit items</Link></p>
      <section className="card">
        <div className="lines">
          {cart.lines.map((l) => (
            <div key={l.key} className="row between">
              <div><div className="row"><VegMark veg={l.veg} /><b>{l.name}</b></div>
                <div className="small muted">{[l.portion, ...l.addOns].filter(Boolean).join(" · ")}</div></div>
              <div className="row">
                <div className="stepper"><button aria-label={`Fewer ${l.name}`} onClick={() => dispatch({ type: "qty", key: l.key, qty: l.qty - 1 })}>−</button><b>{l.qty}</b><button aria-label={`More ${l.name}`} onClick={() => dispatch({ type: "qty", key: l.key, qty: Math.min(20, l.qty + 1) })}>+</button></div>
                <span className="price" style={{ minWidth: 70, textAlign: "right" }}>{formatINR(l.unitPaise * l.qty)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="totals">
          <div className="row between"><span>Subtotal</span><span>{totals ? formatINR(totals.subtotalPaise) : "…"}</span></div>
          {totals && totals.discountPaise > 0 && <div className="row between" style={{ color: "var(--ok)" }}><span>Coupon {applied}</span><span>−{formatINR(totals.discountPaise)}</span></div>}
          {totals && totals.loyaltyPaise > 0 && <div className="row between" style={{ color: "var(--ok)" }}><span>{totals.redeemPoints} points</span><span>−{formatINR(totals.loyaltyPaise)}</span></div>}
          <div className="row between grand"><span>Total</span><span>{totals ? formatINR(totals.totalPaise) : "…"}</span></div>
          <p className="small muted">Prices include 5% GST{totals ? ` (${formatINR(totals.gstIncludedPaise)})` : ""}.</p>
        </div>
      </section>
      {totals && totals.balance > 0 && (
        <label className="card row between" style={{ padding: 14 }}>
          <span><b>Use my points</b><br /><span className="small muted">You have {totals.balance} points. {totals.maxRedeemPoints > 0 ? `Up to ${totals.maxRedeemPoints} can be used here (saves ${formatINR(totals.maxRedeemPoints * 50)}).` : "Not enough order value to use points yet."}</span></span>
          <input type="checkbox" aria-label="Use my points" checked={redeem > 0} disabled={totals.maxRedeemPoints === 0} onChange={(e) => setRedeem(e.target.checked ? totals.maxRedeemPoints : 0)} />
        </label>
      )}
      <div className="field"><label htmlFor="c">Coupon code</label>
        <div className="row"><input id="c" className="input" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="e.g. DIRECT10" /><button className="btn ghost" onClick={applyCoupon} disabled={!coupon.trim()}>Apply</button></div>
        {couponErr && <span className="error small" role="alert">{couponErr}</span>}</div>
      <section className="stack">
        <h2>Pay (test mode)</h2>
        <div className="tabs" role="group" aria-label="Payment method">
          <button className="tab" aria-pressed={method === "UPI"} onClick={() => setMethod("UPI")}>UPI</button>
          <button className="tab" aria-pressed={method === "CARD"} onClick={() => setMethod("CARD")}>Card</button>
        </div>
        {method === "UPI"
          ? <div className="field"><label htmlFor="v">UPI ID</label><input id="v" className="input" inputMode="email" placeholder="name@bank" value={vpa} onChange={(e) => setVpa(e.target.value)} /></div>
          : <div className="field"><label htmlFor="k">Card number</label><input id="k" className="input" inputMode="numeric" autoComplete="cc-number" placeholder="4111 1111 1111 1111" value={card} onChange={(e) => setCard(e.target.value)} /></div>}
        <p className="small muted">Test mode: nothing is charged. Use <code>4111 1111 1111 1111</code> or any valid UPI id like <code>demo@okbank</code>. <code>fail@test</code> simulates a decline.</p>
      </section>
      {totals && totals.pointsEarned > 0 && <p className="small muted">You will earn {totals.pointsEarned} points on this order.</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" onClick={place} disabled={busy || !totals || (method === "UPI" ? !vpa.trim() : !card.trim())}>{busy ? "Placing order…" : `Pay ${totals ? formatINR(totals.totalPaise) : ""}`}</button>
    </main>
  );
}
