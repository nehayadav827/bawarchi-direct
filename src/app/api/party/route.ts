import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { createPartyOrder, listMyPartyOrders, PARTY_RULES } from "@/server/party";
import { requireUser } from "@/server/auth";
import { createLimiter } from "@/server/ratelimit";
import { HttpError } from "@/server/errors";
import { handle, readJson, currentUser } from "@/server/http";

export const dynamic = "force-dynamic";
const limit = createLimiter(10, 60 * 60 * 1000);

export function GET() {
  return handle(async () => ({ rules: PARTY_RULES, orders: await listMyPartyOrders(await getDb(), requireUser(await currentUser())) }));
}

export function POST(req: Request) {
  return handle(async () => {
    const user = requireUser(await currentUser());
    if (!limit(user.id)) throw new HttpError(429, "TOO_MANY_REQUESTS", "Too many requests, please wait");
    return NextResponse.json(await createPartyOrder(await getDb(), user, await readJson(req)), { status: 201 });
  });
}
