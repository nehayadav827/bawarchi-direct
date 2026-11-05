export interface Point { lat: number; lng: number }
export interface ServiceOutlet extends Point { id: string; radiusKm: number; active: boolean }

const R = 6371; // km

/** Straight-line distance (assumption A3: not road distance). */
export function haversineKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Active outlets whose delivery radius covers the point, nearest first. */
export function outletsServing<T extends ServiceOutlet>(point: Point, outlets: T[]): (T & { distanceKm: number })[] {
  return outlets
    .filter((o) => o.active)
    .map((o) => ({ ...o, distanceKm: haversineKm(point, o) }))
    .filter((o) => o.distanceKm <= o.radiusKm)
    .sort((x, y) => x.distanceKm - y.distanceKm);
}
