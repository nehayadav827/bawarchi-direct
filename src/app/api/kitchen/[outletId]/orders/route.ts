import { getDb } from "@/db/client";
import { listKitchenOrders } from "@/server/orders";
import { requireUser } from "@/server/auth";
import { handle, currentUser } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: { params: Promise<{ outletId: string }> }) {
  return handle(async () => {
    const { outletId } = await params;
    return listKitchenOrders(await getDb(), requireUser(await currentUser()), outletId);
  });
}
