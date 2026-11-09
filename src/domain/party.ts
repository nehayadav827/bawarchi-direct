/** Party order rules (assumption A16): at least 48 hours notice, 10 to 500 guests. */
export const PARTY_MIN_NOTICE_HOURS = 48;
export const PARTY_MIN_GUESTS = 10;
export const PARTY_MAX_GUESTS = 500;

export type PartyCheck = { ok: true } | { ok: false; reason: "NOTICE" | "GUESTS" | "PAST" };

export function validateParty(eventAt: Date, now: Date, guests: number): PartyCheck {
  if (!Number.isInteger(guests) || guests < PARTY_MIN_GUESTS || guests > PARTY_MAX_GUESTS) return { ok: false, reason: "GUESTS" };
  if (Number.isNaN(eventAt.getTime()) || eventAt.getTime() <= now.getTime()) return { ok: false, reason: "PAST" };
  if (eventAt.getTime() - now.getTime() < PARTY_MIN_NOTICE_HOURS * 3600_000) return { ok: false, reason: "NOTICE" };
  return { ok: true };
}
