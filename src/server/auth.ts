import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { Db } from "@/db/client";
import { users, type Role } from "@/db/schema";
import { HttpError } from "./errors";

export interface SessionUser { id: string; name: string; role: Role; outletId: string | null }
export const SESSION_COOKIE = "bd_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set in production");
    return new TextEncoder().encode("dev-only-not-a-secret"); // local development only
  }
  return new TextEncoder().encode(s);
}

export async function verifyLogin(db: Db, email: string, password: string): Promise<SessionUser | null> {
  const [u] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  // Compare against a dummy hash when the user is missing so timing does not reveal valid emails.
  const ok = await bcrypt.compare(password, u?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");
  if (!u || !ok) return null;
  return { id: u.id, name: u.name, role: u.role, outletId: u.outletId };
}

export async function signSession(u: SessionUser): Promise<string> {
  return new SignJWT({ ...u }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE_SECONDS}s`).sign(secret());
}

export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: String(payload.id), name: String(payload.name), role: payload.role as Role, outletId: (payload.outletId as string | null) ?? null };
  } catch {
    return null;
  }
}

export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_SECONDS };

export function requireUser(u: SessionUser | null): SessionUser {
  if (!u) throw new HttpError(401, "UNAUTHENTICATED", "Sign in required");
  return u;
}

/** Role gate. Staff roles are also scoped to their outlet when outletId is given. Admin may act anywhere. */
export function requireRole(u: SessionUser | null, roles: Role[], outletId?: string): SessionUser {
  const user = requireUser(u);
  if (!roles.includes(user.role)) throw new HttpError(403, "FORBIDDEN", "Not allowed for your role");
  if (outletId && user.role !== "admin" && user.role !== "customer" && user.outletId !== outletId) {
    throw new HttpError(403, "WRONG_OUTLET", "Not your outlet");
  }
  return user;
}
