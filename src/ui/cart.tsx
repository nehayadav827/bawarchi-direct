"use client";
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";

export interface CartLine { key: string; itemId: string; name: string; veg: boolean; portion?: string; addOns: string[]; unitPaise: number; qty: number }
interface State { outletId: string | null; outletName: string | null; lines: CartLine[] }
type Action =
  | { type: "add"; outletId: string; outletName: string; line: Omit<CartLine, "key"> }
  | { type: "qty"; key: string; qty: number } | { type: "clear" } | { type: "load"; state: State };

const EMPTY: State = { outletId: null, outletName: null, lines: [] };
const KEY = "bd_cart_v1";
export const lineKey = (l: { itemId: string; portion?: string; addOns: string[] }) => `${l.itemId}|${l.portion ?? ""}|${[...l.addOns].sort().join(",")}`;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "load": return a.state;
    case "clear": return EMPTY;
    case "add": {
      const base = s.outletId === a.outletId ? s : { outletId: a.outletId, outletName: a.outletName, lines: [] }; // one outlet per cart
      const key = lineKey(a.line);
      const found = base.lines.find((l) => l.key === key);
      const lines = found
        ? base.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + a.line.qty) } : l))
        : [...base.lines, { ...a.line, key }];
      return { ...base, lines };
    }
    case "qty": {
      const lines = s.lines.map((l) => (l.key === a.key ? { ...l, qty: a.qty } : l)).filter((l) => l.qty > 0);
      return lines.length ? { ...s, lines } : EMPTY;
    }
  }
}

const Ctx = createContext<{ cart: State; dispatch: (a: Action) => void; count: number; subtotalPaise: number } | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(reducer, EMPTY);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) dispatch({ type: "load", state: JSON.parse(raw) as State }); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* storage unavailable */ } }, [cart]);
  const value = useMemo(() => ({
    cart, dispatch, count: cart.lines.reduce((n, l) => n + l.qty, 0), subtotalPaise: cart.lines.reduce((n, l) => n + l.unitPaise * l.qty, 0),
  }), [cart]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
