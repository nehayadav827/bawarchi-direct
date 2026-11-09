import { getDb } from "@/db/client";
import { decidePartyOrder } from "@/server/party";
import { requireUser } from "@/server/auth";
import { handle, readJson, currentUser } from "@/server/http";

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    return decidePartyOrder(await getDb(), requireUser(await currentUser()), id, await readJson(req));
  });
}
