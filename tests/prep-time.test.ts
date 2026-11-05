import { describe, it, expect } from "vitest";
import { estimatePrep, lateness, type EstimateInput } from "@/domain/prep-time";

const base: EstimateInput = {
  items: [{ prepMinutes: 25, qty: 1 }],
  openLoadUnits: 0,
  capacityUnits: 10,
  day: 2,
  hour: 14,
  outletMinMinutes: 20,
};

describe("estimatePrep", () => {
  it("quiet kitchen: slowest item time", () => {
    expect(estimatePrep(base)).toEqual({ estimateMinutes: 25, promisedMinutes: 25, source: "model" });
  });
  it("busier kitchen gives a longer, honest estimate", () => {
    const r = estimatePrep({ ...base, openLoadUnits: 10 });
    expect(r.estimateMinutes).toBe(35);
  });
  it("queue delay is capped at 2x capacity", () => {
    const r = estimatePrep({ ...base, openLoadUnits: 1000 });
    expect(r.estimateMinutes).toBe(45);
  });
  it("adds a bulk allowance for large orders", () => {
    const r = estimatePrep({ ...base, items: [{ prepMinutes: 25, qty: 9 }] });
    expect(r.estimateMinutes).toBe(29);
  });
  it("applies the Friday dinner peak factor", () => {
    const r = estimatePrep({ ...base, day: 5, hour: 20 });
    expect(r.estimateMinutes).toBe(Math.ceil(25 * 1.15));
  });
  it("promised time is never below the outlet minimum", () => {
    const r = estimatePrep({ ...base, items: [{ prepMinutes: 8, qty: 1 }] });
    expect(r.estimateMinutes).toBe(8);
    expect(r.promisedMinutes).toBe(20);
  });
  it("manager override wins and is labelled", () => {
    expect(estimatePrep({ ...base, overrideMinutes: 50 })).toEqual({ estimateMinutes: null, promisedMinutes: 50, source: "override" });
  });
  it("falls back to the outlet minimum on bad input", () => {
    for (const bad of [{ items: [] }, { capacityUnits: 0 }, { openLoadUnits: NaN }, { items: [{ prepMinutes: 0, qty: 1 }] }]) {
      expect(estimatePrep({ ...base, ...bad })).toEqual({ estimateMinutes: null, promisedMinutes: 20, source: "fallback" });
    }
  });
});

describe("lateness", () => {
  const promised = new Date("2026-11-06T20:59:00+05:30");
  const at = (m: number) => new Date(promised.getTime() + m * 60000);
  it("on time up to the promise", () => expect(lateness(at(0), promised).state).toBe("ON_TIME"));
  it("late after the promise (sample order: 4 minutes late)", () => {
    expect(lateness(at(4), promised)).toEqual({ state: "LATE", minutesLate: 4 });
  });
  it("alerts at 10 minutes past promise", () => {
    expect(lateness(at(9), promised).state).toBe("LATE");
    expect(lateness(at(10), promised).state).toBe("ALERT");
  });
});
