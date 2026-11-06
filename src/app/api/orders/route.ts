import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { createOrder, listMyOrders } from "@/server/orders";
import { requireUser } from "@/server/auth";
import { createLimiter } from "@/server/ratelimit";
import { HttpError } from "@/server/errors";
import { handle, readJson, currentUser } from "@/server/http";

const limit = createLimiter(20, 10 * 60 * 1000);

export function POST(req: Request) {
  return handle(async () => {
    const user = requireUser(await currentUser());
    if (!limit(user.id)) throw new HttpError(429, "TOO_MANY_ORDERS", "Too many orders, please wait a moment");
    return NextResponse.json(await createOrder(await getDb(), user, await readJson(req)), { status: 201 });
  });
}

export function GET() {
  return handle(async () => ({ orders: await listMyOrders(await getDb(), requireUser(await currentUser())) }));
}
