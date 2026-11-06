import { z } from "zod";
import { getDb } from "@/db/client";
import { transitionOrder } from "@/server/orders";
import { ORDER_STATUSES } from "@/domain/order-state";
import { requireUser } from "@/server/auth";
import { HttpError } from "@/server/errors";
import { handle, readJson, currentUser } from "@/server/http";

const schema = z.object({ to: z.enum(ORDER_STATUSES), reason: z.string().trim().max(200).optional() });

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const user = requireUser(await currentUser());
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new HttpError(422, "INVALID_INPUT", "Unknown status");
    return transitionOrder(await getDb(), user, id, p.data.to, p.data.reason);
  });
}
