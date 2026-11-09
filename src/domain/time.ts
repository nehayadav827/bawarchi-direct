/** All outlet times are IST (Asia/Kolkata). Keeps menu windows and peak logic independent of the server timezone. */
const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function istParts(d: Date): { day: number; hour: number; minute: number; hhmm: string } {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  const minute = Number(p.minute);
  return { day: DAYS.indexOf(String(p.weekday)), hour, minute, hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

/** Time-based menu window, "HH:MM" strings, from inclusive, to exclusive. Null bounds mean all day. */
export function inWindow(from: string | null, to: string | null, hhmm: string): boolean {
  if (!from || !to) return true;
  return from <= to ? hhmm >= from && hhmm < to : hhmm >= from || hhmm < to; // supports windows past midnight
}

/** "8:59 pm" in IST, for customer messages. */
export const istClock = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
