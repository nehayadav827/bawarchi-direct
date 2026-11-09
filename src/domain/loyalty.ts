/** Loyalty rules (assumption A15): 1 point per ₹10 paid, 1 point = ₹0.50, redeem up to 20% of the payable amount. */
export const EARN_PAISE_PER_POINT = 1000;
export const POINT_VALUE_PAISE = 50;
export const MAX_REDEEM_SHARE = 0.2;

export const earnPoints = (paidPaise: number) => Math.max(0, Math.floor(paidPaise / EARN_PAISE_PER_POINT));
export const pointsToPaise = (points: number) => points * POINT_VALUE_PAISE;

/** Most points usable on an amount (after coupon), limited by the balance. */
export function maxRedeemPoints(balance: number, payablePaise: number): number {
  const cap = Math.floor((payablePaise * MAX_REDEEM_SHARE) / POINT_VALUE_PAISE);
  return Math.max(0, Math.min(balance, cap));
}

export type RedeemCheck = { ok: true } | { ok: false; reason: "INVALID" | "NOT_ENOUGH" | "TOO_MUCH" };

export function validateRedeem(points: number, balance: number, payablePaise: number): RedeemCheck {
  if (!Number.isInteger(points) || points < 0) return { ok: false, reason: "INVALID" };
  if (points > balance) return { ok: false, reason: "NOT_ENOUGH" };
  if (points > maxRedeemPoints(balance, payablePaise)) return { ok: false, reason: "TOO_MUCH" };
  return { ok: true };
}
