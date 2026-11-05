import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, isTerminal, ORDER_STATUSES, IllegalTransitionError } from "@/domain/order-state";

describe("order state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("PLACED", "PREPARING")).toBe(true);
    expect(canTransition("PREPARING", "READY")).toBe(true);
    expect(canTransition("READY", "HANDED_OFF")).toBe(true);
  });
  it("allows cancel only before the food is ready", () => {
    expect(canTransition("PLACED", "CANCELLED")).toBe(true);
    expect(canTransition("PREPARING", "CANCELLED")).toBe(true);
    expect(canTransition("READY", "CANCELLED")).toBe(false);
  });
  it("blocks skipping stages and going backwards", () => {
    expect(canTransition("PLACED", "READY")).toBe(false);
    expect(canTransition("READY", "PREPARING")).toBe(false);
  });
  it("terminal states have no exits", () => {
    for (const s of ORDER_STATUSES.filter(isTerminal)) {
      for (const t of ORDER_STATUSES) expect(canTransition(s, t)).toBe(false);
    }
  });
  it("assertTransition throws a typed error", () => {
    expect(() => assertTransition("HANDED_OFF", "PLACED")).toThrow(IllegalTransitionError);
  });
});
