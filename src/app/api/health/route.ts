import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

/** Liveness plus a database round-trip, for the host's health check. Reveals no data. */
export async function GET() {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) return NextResponse.json({ ok: false, reason: "AUTH_SECRET missing" }, { status: 503 });
  try {
    await (await getDb()).execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
