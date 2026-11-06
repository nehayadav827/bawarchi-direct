import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { outlets } from "@/db/schema";
import { haversineKm } from "@/domain/geo";
import { handle } from "@/server/http";

/** GET /api/outlets?lat=&lng= : active outlets; with a location, sorted by distance and flagged if they deliver there. */
export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
    const hasPoint = q.has("lat") && q.has("lng") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const rows = await (await getDb()).select().from(outlets).where(eq(outlets.active, true));
    const list = rows.map((o) => {
      const distanceKm = hasPoint ? haversineKm({ lat, lng }, o) : null;
      return { id: o.id, name: o.name, city: o.city, kind: o.kind, fssai: o.fssai, radiusKm: o.radiusKm, distanceKm, delivers: distanceKm === null ? null : distanceKm <= o.radiusKm };
    });
    if (hasPoint) list.sort((a, b) => a.distanceKm! - b.distanceKm!);
    return NextResponse.json({ outlets: list });
  });
}
