"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface User { id: string; name: string; role: "customer" | "kitchen" | "manager" | "admin"; outletId: string | null }

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setUser((await api<{ user: User | null }>("/api/auth/me")).user); } catch { setUser(null); }
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { user, loading, refresh };
}
