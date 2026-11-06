"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/ui/api";

interface OutletRow { id: string; name: string; city: string; kind: string; fssai: string; radiusKm: number; distanceKm: number | null; delivers: boolean | null }

export default function Home() {
  const [outlets, setOutlets] = useState<OutletRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<"idle" | "asking" | "denied" | "done">("idle");

  const load = useCallback(async (q = "") => {
    try { setOutlets((await api<{ outlets: OutletRow[] }>(`/api/outlets${q}`)).outlets); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load outlets"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function locate() {
    if (!navigator.geolocation) { setGeo("denied"); return; }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo("done"); void load(`?lat=${p.coords.latitude}&lng=${p.coords.longitude}`); },
      () => setGeo("denied"), { timeout: 8000 });
  }

  return (
    <main className="wrap stack">
      <section className="stack">
        <h1>Hyderabad biryani, straight from the kitchen.</h1>
        <p className="muted">Choose your outlet. Prices include 5% GST. Live order tracking, no middleman.</p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn" onClick={locate} disabled={geo === "asking"}>{geo === "asking" ? "Finding you…" : "Use my location"}</button>
          {geo === "denied" && <span className="small muted">Location unavailable. Pick an outlet below.</span>}
        </div>
      </section>
      {error && <div className="notice" role="alert">{error} <button className="link" onClick={() => load()}>Retry</button></div>}
      {!outlets && !error && <div className="outlets">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 88 }} />)}</div>}
      {outlets?.length === 0 && <div className="empty">No outlets are open for ordering right now.</div>}
      <div className="outlets">
        {outlets?.map((o) => (
          <Link key={o.id} href={`/menu/${o.id}`} className="card outlet" aria-label={`Order from ${o.name}`}>
            <h3>{o.name}
              {o.kind === "CLOUD_KITCHEN" && <span className="tag">Cloud kitchen</span>}
              {o.delivers === true && <span className="tag ok">Delivers to you</span>}
              {o.delivers === false && <span className="tag no">Outside delivery area</span>}
            </h3>
            <p className="small muted">{o.distanceKm !== null ? `${o.distanceKm.toFixed(1)} km away · ` : ""}Delivers within {o.radiusKm} km · FSSAI {o.fssai}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
