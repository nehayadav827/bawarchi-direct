import { getDb } from "@/db/client";
import { listOutletPartyOrders } from "@/server/party";
import { requireUser } from "@/server/auth";
import { handle, currentUser } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: { params: Promise<{ outletId: string }> }) {
  return handle(async () => {
    const { outletId } = await params;
    return { orders: await listOutletPartyOrders(await getDb(), requireUser(await currentUser()), outletId) };
  });
}
