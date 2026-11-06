import { z } from "zod";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { signSession, cookieOptions, SESSION_COOKIE } from "@/server/auth";
import { createLimiter } from "@/server/ratelimit";
import { HttpError } from "@/server/errors";
import { handle, readJson, clientIp } from "@/server/http";

const limit = createLimiter(5, 60 * 60 * 1000);
// DPDP: marketingOptIn is an explicit, separate consent and defaults to false.
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  marketingOptIn: z.boolean().default(false),
});

export function POST(req: Request) {
  return handle(async () => {
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new HttpError(422, "INVALID_INPUT", p.error.issues[0]?.message ?? "Invalid details");
    if (!limit(await clientIp())) throw new HttpError(429, "TOO_MANY_ATTEMPTS", "Too many sign-ups from this network");
    const db = await getDb();
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, p.data.email));
    if (exists) throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists");
    const user = { id: randomUUID(), name: p.data.name, role: "customer" as const, outletId: null };
    await db.insert(users).values({ ...user, email: p.data.email, passwordHash: await bcrypt.hash(p.data.password, 10), marketingOptIn: p.data.marketingOptIn });
    (await cookies()).set(SESSION_COOKIE, await signSession(user), cookieOptions);
    return NextResponse.json({ user, home: "/" }, { status: 201 });
  });
}
