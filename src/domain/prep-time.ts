/**
 * Prep-time estimate (assumption A6): transparent, load-based, replaceable by a trained model later.
 *
 * estimate = slowest item prep time
 *          + 2 min per extra 4 units in the order (bulk effect)
 *          + queue delay: up to 10 min x (open kitchen load / capacity), capped at 2x capacity
 * then x1.15 in the Friday/Sunday dinner peak (19:00-22:00 IST).
 * Promised time = max(estimate, outlet minimum). Manager override replaces it. Bad input -> outlet minimum.
 */
export interface EstimateInput {
  items: { prepMinutes: number; qty: number }[];
  openLoadUnits: number; // units currently in PLACED/PREPARING at this outlet
  capacityUnits: number; // units the kitchen can work in parallel
  day: number; // 0=Sunday ... 6=Saturday (IST)
  hour: number; // 0-23 (IST)
  outletMinMinutes: number;
  overrideMinutes?: number | null;
}

export interface Estimate {
  estimateMinutes: number | null;
  promisedMinutes: number;
  source: "model" | "override" | "fallback";
}

const isPeak = (day: number, hour: number) => (day === 5 || day === 0) && hour >= 19 && hour < 22;

export function estimatePrep(i: EstimateInput): Estimate {
  if (i.overrideMinutes != null && i.overrideMinutes > 0) {
    return { estimateMinutes: null, promisedMinutes: Math.ceil(i.overrideMinutes), source: "override" };
  }
  const bad =
    i.items.length === 0 ||
    i.items.some((x) => !(x.prepMinutes > 0) || !Number.isInteger(x.qty) || x.qty < 1) ||
    !(i.capacityUnits > 0) ||
    i.openLoadUnits < 0 ||
    !Number.isFinite(i.openLoadUnits);
  if (bad) return { estimateMinutes: null, promisedMinutes: i.outletMinMinutes, source: "fallback" };

  const slowest = Math.max(...i.items.map((x) => x.prepMinutes));
  const units = i.items.reduce((s, x) => s + x.qty, 0);
  const bulk = 2 * Math.floor(Math.max(0, units - 1) / 4);
  const queue = 10 * Math.min(i.openLoadUnits / i.capacityUnits, 2);
  let est = slowest + bulk + queue;
  if (isPeak(i.day, i.hour)) est *= 1.15;
  const estimateMinutes = Math.ceil(est);
  return { estimateMinutes, promisedMinutes: Math.max(estimateMinutes, i.outletMinMinutes), source: "model" };
}

export type Lateness = "ON_TIME" | "LATE" | "ALERT";
export const ALERT_AFTER_MINUTES = 10;

/** LATE once past the promise; ALERT (manager + customer notified) 10 minutes past it. */
export function lateness(now: Date, promisedAt: Date): { state: Lateness; minutesLate: number } {
  const minutesLate = Math.floor((now.getTime() - promisedAt.getTime()) / 60000);
  if (minutesLate >= ALERT_AFTER_MINUTES) return { state: "ALERT", minutesLate };
  if (minutesLate > 0) return { state: "LATE", minutesLate };
  return { state: "ON_TIME", minutesLate: 0 };
}
