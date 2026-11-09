export type Lateness = { state: "ON_TIME" | "LATE" | "ALERT"; minutesLate: number };
export interface OrderView {
  id: string; outletId: string; status: "PLACED" | "PREPARING" | "READY" | "HANDED_OFF" | "CANCELLED";
  totalPaise: number; gstPaise: number; placedAt: string; promisedAt: string; promiseSource: string; lateness: Lateness; cancelReason: string | null; pointsEarned: number; pointsRedeemed: number; loyaltyPaise: number; messages?: { id: number; channel: string; message: string; createdAt: string }[];
  items: { id: number; name: string; portion: string | null; addOns: string[]; qty: number }[];
}
