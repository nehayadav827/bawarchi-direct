export const ORDER_STATUSES = ["PLACED", "PREPARING", "READY", "HANDED_OFF", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["HANDED_OFF"],
  HANDED_OFF: [],
  CANCELLED: [],
};

export const isTerminal = (s: OrderStatus) => NEXT[s].length === 0;
export const canTransition = (from: OrderStatus, to: OrderStatus) => NEXT[from].includes(to);
export const nextStatuses = (from: OrderStatus) => NEXT[from];

export class IllegalTransitionError extends Error {
  constructor(public from: OrderStatus, public to: OrderStatus) {
    super(`Illegal order transition ${from} -> ${to}`);
  }
}

/** Server-side guard: throws on illegal moves so the API can return 409. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}
