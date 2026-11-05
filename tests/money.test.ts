import { describe, it, expect } from "vitest";
import { computeTotals, gstIncluded, applyCoupon, lineTotal, formatINR } from "@/domain/money";

describe("money", () => {
  it("extracts 5% GST from an inclusive total", () => {
    expect(gstIncluded(10500)).toBe(500);
    expect(gstIncluded(118000)).toBe(5619); // sample order WEB-778120, 1180 rupees
  });
  it("totals lines with add-ons", () => {
    expect(lineTotal({ unitPaise: 40000, addOnPaise: 5000, qty: 2 })).toBe(90000);
  });
  it("rejects bad quantities and negative prices", () => {
    expect(() => lineTotal({ unitPaise: 100, qty: 0 })).toThrow();
    expect(() => lineTotal({ unitPaise: -1, qty: 1 })).toThrow();
  });
  it("applies a capped percent coupon", () => {
    const r = applyCoupon(100000, { code: "BIRYANI10", type: "PERCENT", value: 10, maxDiscountPaise: 5000 });
    expect(r).toEqual({ ok: true, discountPaise: 5000 });
  });
  it("rejects a coupon below minimum order", () => {
    const r = applyCoupon(20000, { code: "FLAT100", type: "FLAT", value: 10000, minOrderPaise: 50000 });
    expect(r).toEqual({ ok: false, reason: "MIN_ORDER" });
  });
  it("never discounts below zero", () => {
    expect(applyCoupon(5000, { code: "BIG", type: "FLAT", value: 99999 })).toEqual({ ok: true, discountPaise: 5000 });
  });
  it("computes totals; invalid coupon gives no discount", () => {
    const t = computeTotals([{ unitPaise: 30000, qty: 2 }], { code: "X", type: "FLAT", value: 5000, minOrderPaise: 999999 });
    expect(t).toMatchObject({ subtotalPaise: 60000, discountPaise: 0, totalPaise: 60000 });
  });
  it("formats rupees", () => {
    expect(formatINR(118000)).toBe("₹1,180");
    expect(formatINR(12550)).toBe("₹125.50");
  });
});
