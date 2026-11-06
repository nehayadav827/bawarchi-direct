import { getDb } from "@/db/client";
import { quoteOrder } from "@/server/orders";
import { requireUser } from "@/server/auth";
import { handle, readJson, currentUser } from "@/server/http";

export function POST(req: Request) {
  return handle(async () => quoteOrder(await getDb(), requireUser(await currentUser()), await readJson(req)));
}
