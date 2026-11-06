import { describe, it, expect } from "vitest";
import { createLimiter } from "@/server/ratelimit";

describe("rate limiter", () => {
  it("allows up to max per window, then blocks, then resets", () => {
    const hit = createLimiter(3, 1000);
    expect([hit("a", 0), hit("a", 1), hit("a", 2), hit("a", 3)]).toEqual([true, true, true, false]);
    expect(hit("b", 3)).toBe(true); // keys are independent
    expect(hit("a", 1000)).toBe(true); // new window
  });
});
