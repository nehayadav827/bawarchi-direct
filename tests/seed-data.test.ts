import { describe, it, expect } from "vitest";
import { MENU, OUTLETS, SAMPLE_ORDERS } from "@/data/seed-data";
import { lineTotal } from "@/domain/money";

describe("seed data", () => {
  it("has unique item slugs and 14-digit FSSAI numbers", () => {
    expect(new Set(MENU.map((m) => m.slug)).size).toBe(MENU.length);
    for (const o of OUTLETS) expect(o.fssai).toMatch(/^\d{14}$/);
  });
  it("sample orders reference real outlets and items", () => {
    for (const o of SAMPLE_ORDERS) {
      expect(OUTLETS.some((x) => x.id === o.outletId)).toBe(true);
      for (const [slug] of o.items) expect(MENU.some((m) => m.slug === slug)).toBe(true);
    }
  });
  it("sample order totals match the brief", () => {
    const price = (slug: string, portion: string | null) => {
      const m = MENU.find((x) => x.slug === slug)!;
      return portion ? m.portions!.find((p) => p.label === portion)!.pricePaise : m.pricePaise;
    };
    for (const o of SAMPLE_ORDERS) {
      const sum = o.items.reduce((s, [slug, portion, qty]) => s + lineTotal({ unitPaise: price(slug, portion), qty }), 0);
      expect(sum, o.ref).toBe(o.totalPaise);
    }
  });
});
