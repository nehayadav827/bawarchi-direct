import { describe, it, expect } from "vitest";
import { istParts, inWindow } from "@/domain/time";

describe("time", () => {
  it("converts to IST regardless of server timezone", () => {
    const p = istParts(new Date("2026-11-06T14:30:00Z")); // Friday 20:00 IST
    expect(p).toMatchObject({ day: 5, hour: 20, minute: 0, hhmm: "20:00" });
  });
  it("handles windows", () => {
    expect(inWindow("16:00", "23:00", "15:59")).toBe(false);
    expect(inWindow("16:00", "23:00", "16:00")).toBe(true);
    expect(inWindow("16:00", "23:00", "23:00")).toBe(false);
    expect(inWindow(null, null, "03:00")).toBe(true);
    expect(inWindow("22:00", "02:00", "01:00")).toBe(true);
  });
});
