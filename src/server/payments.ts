import { randomUUID } from "node:crypto";
import { z } from "zod";

/** Mock gateway (assumption A5). Test mode only: nothing is charged, and card numbers are never stored. */
export const paymentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("UPI"), vpa: z.string().regex(/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/, "Enter a valid UPI id") }),
  z.object({ method: z.literal("CARD"), number: z.string().regex(/^\d{13,19}$/, "Enter a valid card number") }),
]);
export type PaymentInput = z.infer<typeof paymentSchema>;

export const TEST_DECLINE_CARD = "4000000000000002";
export const TEST_DECLINE_VPA = "fail@test";

const luhn = (n: string) => {
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
};

export type PayResult = { ok: true; ref: string } | { ok: false; reason: "DECLINED" | "INVALID_CARD" };

export function mockPay(p: PaymentInput, _amountPaise: number): PayResult {
  if (p.method === "UPI") return p.vpa.toLowerCase() === TEST_DECLINE_VPA ? { ok: false, reason: "DECLINED" } : { ok: true, ref: `mock_upi_${randomUUID()}` };
  if (!luhn(p.number)) return { ok: false, reason: "INVALID_CARD" };
  if (p.number === TEST_DECLINE_CARD) return { ok: false, reason: "DECLINED" };
  return { ok: true, ref: `mock_card_${randomUUID()}` };
}
