/** All money is integer paise. Prices are GST-inclusive at 5% (assumption A9). */
export const GST_RATE_PERCENT = 5;

export interface CartLine { unitPaise: number; addOnPaise?: number; qty: number }

export type Coupon =
  | { code: string; type: "PERCENT"; value: number; minOrderPaise?: number; maxDiscountPaise?: number }
  | { code: string; type: "FLAT"; value: number; minOrderPaise?: number };

export function lineTotal(l: CartLine): number {
  if (!Number.isInteger(l.qty) || l.qty < 1) throw new RangeError("qty must be a positive integer");
  if (l.unitPaise < 0 || (l.addOnPaise ?? 0) < 0) throw new RangeError("price cannot be negative");
  return (l.unitPaise + (l.addOnPaise ?? 0)) * l.qty;
}

export function subtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

/** GST contained in a GST-inclusive amount. */
export function gstIncluded(inclusivePaise: number): number {
  return Math.round((inclusivePaise * GST_RATE_PERCENT) / (100 + GST_RATE_PERCENT));
}

export type CouponResult = { ok: true; discountPaise: number } | { ok: false; reason: "MIN_ORDER" | "INVALID" };

export function applyCoupon(subtotalPaise: number, coupon: Coupon | null): CouponResult {
  if (!coupon) return { ok: true, discountPaise: 0 };
  if (coupon.value <= 0) return { ok: false, reason: "INVALID" };
  if (coupon.minOrderPaise && subtotalPaise < coupon.minOrderPaise) return { ok: false, reason: "MIN_ORDER" };
  let d = coupon.type === "PERCENT" ? Math.floor((subtotalPaise * coupon.value) / 100) : coupon.value;
  if (coupon.type === "PERCENT" && coupon.maxDiscountPaise) d = Math.min(d, coupon.maxDiscountPaise);
  return { ok: true, discountPaise: Math.min(d, subtotalPaise) }; // never below zero
}

export interface Totals { subtotalPaise: number; discountPaise: number; loyaltyPaise: number; totalPaise: number; gstIncludedPaise: number }

/** loyaltyPaise is taken off after the coupon and can never take the total below zero. */
export function computeTotals(lines: CartLine[], coupon: Coupon | null, loyaltyPaise = 0): Totals {
  const sub = subtotal(lines);
  const res = applyCoupon(sub, coupon);
  const discount = res.ok ? res.discountPaise : 0;
  const afterCoupon = sub - discount;
  const loyalty = Math.min(Math.max(0, loyaltyPaise), afterCoupon);
  const total = afterCoupon - loyalty;
  return { subtotalPaise: sub, discountPaise: discount, loyaltyPaise: loyalty, totalPaise: total, gstIncludedPaise: gstIncluded(total) };
}

export const formatINR = (paise: number) =>
  "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 });
