"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, istTime } from "@/ui/api";
import { formatINR } from "@/domain/money";
import type { OrderView } from "@/ui/useOrderStream";

export default function MyOrders() {
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  useEffect(() => { api<{ orders: OrderView[] }>("/api/orders").then((r) => setOrders(r.orders)).catch((e) => setError({ status: e.status, message: e.message })); }, []);
  return (
    <main className="wrap stack" style={{ maxWidth: 560 }}>
      <h1>My orders</h1>
      {error && <div className="notice" role="alert">{error.message} {error.status === 401 && <Link href="/login?next=/orders">Sign in</Link>}</div>}
      {!orders && !error && <div className="skeleton" style={{ height: 120 }} />}
      {orders?.length === 0 && <div className="empty">No orders yet. <Link href="/">Browse the menu</Link></div>}
      {orders?.map((o) => (
        <Link key={o.id} href={`/orders/${o.id}`} className="card outlet">
          <div className="row between"><b>{o.id}</b><span className="tag">{o.status.replace("_", " ").toLowerCase()}</span></div>
          <p className="small muted">{istTime(o.placedAt)} · {formatINR(o.totalPaise)} · {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
        </Link>
      ))}
    </main>
  );
}
