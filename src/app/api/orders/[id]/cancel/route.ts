import { getDb } from "@/db/client";
import { cancelOwnOrder } from "@/server/orders";
import { requireUser } from "@/server/auth";
import { handle, currentUser } from "@/server/http";

export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    return cancelOwnOrder(await getDb(), requireUser(await currentUser()), id);
  });
}
