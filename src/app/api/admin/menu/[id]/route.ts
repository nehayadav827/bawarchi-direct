import { getDb } from "@/db/client";
import { updateMenuItem } from "@/server/admin-menu";
import { handle, readJson, currentUser } from "@/server/http";

export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    return updateMenuItem(await getDb(), await currentUser(), id, await readJson(req));
  });
}
