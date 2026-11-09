import { describe, it, expect } from "vitest";
import { earnPoints, maxRedeemPoints, validateRedeem, pointsToPaise } from "@/domain/loyalty";
import { validateParty } from "@/domain/party";
import { computeTotals } from "@/domain/money";

describe("loyalty", () => {
  it("earns 1 point per ₹10 paid, rounded down", () => {
    expect(earnPoints(118000)).toBe(118);
    expect(earnPoints(999)).toBe(0);
    expect(earnPoints(1999)).toBe(1);
  });
  it("converts points to rupees at 50 paise each", () => expect(pointsToPaise(100)).toBe(5000));
  it("caps redemption at 20% of the payable amount and at the balance", () => {
    expect(maxRedeemPoints(1000, 50000)).toBe(200); // 20% of ₹500 = ₹100 = 200 points
    expect(maxRedeemPoints(50, 50000)).toBe(50);
    expect(maxRedeemPoints(0, 50000)).toBe(0);
  });
  it("validates a redemption", () => {
    expect(validateRedeem(100, 500, 50000)).toEqual({ ok: true });
    expect(validateRedeem(-1, 500, 50000)).toEqual({ ok: false, reason: "INVALID" });
    expect(validateRedeem(1.5, 500, 50000)).toEqual({ ok: false, reason: "INVALID" });
    expect(validateRedeem(600, 500, 50000)).toEqual({ ok: false, reason: "NOT_ENOUGH" });
    expect(validateRedeem(300, 500, 50000)).toEqual({ ok: false, reason: "TOO_MUCH" });
  });
  it("takes loyalty off after the coupon and never below zero", () => {
    const t = computeTotals([{ unitPaise: 50000, qty: 1 }], { code: "F", type: "FLAT", value: 5000 }, 4000);
    expect(t).toMatchObject({ discountPaise: 5000, loyaltyPaise: 4000, totalPaise: 41000 });
    expect(computeTotals([{ unitPaise: 1000, qty: 1 }], null, 99999).totalPaise).toBe(0);
  });
});

describe("party order rules", () => {
  const now = new Date("2026-11-10T10:00:00Z");
  const at = (h: number) => new Date(now.getTime() + h * 3600_000);
  it("needs 48 hours notice", () => {
    expect(validateParty(at(47), now, 20)).toEqual({ ok: false, reason: "NOTICE" });
    expect(validateParty(at(48), now, 20)).toEqual({ ok: true });
  });
  it("rejects past dates and bad guest counts", () => {
    expect(validateParty(at(-1), now, 20)).toEqual({ ok: false, reason: "PAST" });
    expect(validateParty(at(100), now, 9)).toEqual({ ok: false, reason: "GUESTS" });
    expect(validateParty(at(100), now, 501)).toEqual({ ok: false, reason: "GUESTS" });
    expect(validateParty(new Date("nope"), now, 20)).toEqual({ ok: false, reason: "PAST" });
  });
});
