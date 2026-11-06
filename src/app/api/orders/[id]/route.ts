import { getDb } from "@/db/client";
import { getOrder } from "@/server/orders";
import { requireUser } from "@/server/auth";
import { handle, currentUser } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    return getOrder(await getDb(), requireUser(await currentUser()), id);
  });
}
