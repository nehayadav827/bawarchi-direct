"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { useUser } from "./useUser";

export function Header() {
  const { user, loading } = useUser();
  const router = useRouter();
  async function signOut() { await api("/api/auth/logout", { method: "POST", body: {} }); router.push("/"); router.refresh(); window.location.href = "/"; }
  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">Biryani Direct</Link>
        <span className="spacer" />
        {user?.role === "customer" && <><Link className="link" href="/party">Party orders</Link><Link className="link" href="/orders">My orders</Link></>}
        {(user?.role === "kitchen" || user?.role === "manager") && <Link className="link" href={`/kitchen/${user.outletId}`}>Kitchen</Link>}
        {(user?.role === "manager" || user?.role === "admin") && <Link className="link" href="/dashboard">Dashboard</Link>}
        {user?.role === "admin" && <Link className="link" href="/admin">Menu admin</Link>}
        {!loading && (user
          ? <button className="link" onClick={signOut}>Sign out ({user.name.split(" ")[0]})</button>
          : <Link className="link" href="/login">Sign in</Link>)}
      </div>
    </header>
  );
}
