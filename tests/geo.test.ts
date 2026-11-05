import { describe, it, expect } from "vitest";
import { haversineKm, outletsServing } from "@/domain/geo";

const kondapur = { id: "kon", lat: 17.4605, lng: 78.3645, radiusKm: 5, active: true };
const kukatpally = { id: "kuk", lat: 17.4948, lng: 78.3996, radiusKm: 5, active: true };

describe("geo", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(kondapur, kondapur)).toBeCloseTo(0, 5);
  });
  it("returns plausible distance between two Hyderabad areas", () => {
    const d = haversineKm(kondapur, kukatpally);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(7);
  });
  it("returns only outlets covering the point, nearest first", () => {
    const near = { lat: 17.462, lng: 78.366 };
    const res = outletsServing(near, [kukatpally, kondapur]);
    expect(res.map((o) => o.id)).toEqual(["kon"]);
  });
  it("skips inactive outlets", () => {
    const res = outletsServing(kondapur, [{ ...kondapur, active: false }]);
    expect(res).toEqual([]);
  });
});
