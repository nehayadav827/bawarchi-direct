"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/ui/api";

const DEMOS = [
  { label: "Customer", email: "customer@demo.test" }, { label: "Kitchen (Kondapur)", email: "kitchen.kondapur@demo.test" },
  { label: "Manager (Kondapur)", email: "manager.kondapur@demo.test" }, { label: "Admin", email: "admin@demo.test" },
];

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ name: "", email: "", password: "", marketing: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = mode === "in"
        ? await api<{ home: string }>("/api/auth/login", { body: { email: f.email, password: f.password } })
        : await api<{ home: string }>("/api/auth/register", { body: { name: f.name, email: f.email, password: f.password, marketingOptIn: f.marketing } });
      window.location.href = next && next.startsWith("/") ? next : r.home; // full reload so the header picks up the session
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not sign in"); setBusy(false); }
  }

  return (
    <main className="wrap stack" style={{ maxWidth: 440 }}>
      <h1>{mode === "in" ? "Sign in" : "Create your account"}</h1>
      <form className="stack" onSubmit={submit} noValidate>
        {mode === "up" && <div className="field"><label htmlFor="n">Name</label><input id="n" className="input" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>}
        <div className="field"><label htmlFor="e">Email</label><input id="e" className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
        <div className="field"><label htmlFor="p">Password</label><input id="p" className="input" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div>
        {mode === "up" && (
          <label className="row small"><input type="checkbox" checked={f.marketing} onChange={(e) => setF({ ...f, marketing: e.target.checked })} />
            <span>Send me offers and rewards updates (optional). We use your details only to process orders unless you tick this.</span></label>
        )}
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      <button className="link" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(null); }}>{mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
      {mode === "in" && (
        <section className="card" style={{ padding: 16 }}>
          <h3>Demo accounts</h3>
          <p className="small muted">Fictional accounts for reviewers. Password: <code>Demo@1234</code></p>
          <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>
            {DEMOS.map((d) => <button key={d.email} type="button" className="btn ghost sm" onClick={() => setF({ ...f, email: d.email, password: "Demo@1234" })}>{d.label}</button>)}
          </div>
        </section>
      )}
    </main>
  );
}

export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
