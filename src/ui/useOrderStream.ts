export type Lateness = { state: "ON_TIME" | "LATE" | "ALERT"; minutesLate: number };
export interface OrderView {
  id: string; outletId: string; status: "PLACED" | "PREPARING" | "READY" | "HANDED_OFF" | "CANCELLED";
  totalPaise: number; gstPaise: number; placedAt: string; promisedAt: string; promiseSource: string; lateness: Lateness; cancelReason: string | null;
  items: { id: number; name: string; portion: string | null; addOns: string[]; qty: number }[];
}
