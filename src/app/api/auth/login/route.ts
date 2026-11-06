import { z } from "zod";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { verifyLogin, signSession, cookieOptions, SESSION_COOKIE } from "@/server/auth";
import { createLimiter } from "@/server/ratelimit";
import { HttpError } from "@/server/errors";
import { handle, readJson, clientIp } from "@/server/http";
import { homeFor } from "@/server/home";

const limit = createLimiter(8, 10 * 60 * 1000);
const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export function POST(req: Request) {
  return handle(async () => {
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new HttpError(422, "INVALID_INPUT", "Enter a valid email and password");
    if (!limit(`${await clientIp()}|${p.data.email.toLowerCase()}`)) throw new HttpError(429, "TOO_MANY_ATTEMPTS", "Too many attempts, try again in a few minutes");
    const user = await verifyLogin(await getDb(), p.data.email, p.data.password);
    if (!user) throw new HttpError(401, "BAD_CREDENTIALS", "Email or password is incorrect");
    (await cookies()).set(SESSION_COOKIE, await signSession(user), cookieOptions);
    return NextResponse.json({ user, home: homeFor(user) });
  });
}
