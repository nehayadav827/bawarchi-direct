import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { HttpError } from "./errors";
import { readSession, SESSION_COOKIE, type SessionUser } from "./auth";

export async function currentUser(): Promise<SessionUser | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new HttpError(400, "BAD_JSON", "Request body must be JSON"); }
}

/** Wraps a route: HttpError becomes a clean JSON error, anything else a generic 500 (details stay in the server log). */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const out = await fn();
    return out instanceof Response ? out : NextResponse.json(out);
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
  }
}
