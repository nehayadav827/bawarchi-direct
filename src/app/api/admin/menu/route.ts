import { getDb } from "@/db/client";
import { listAdminMenu } from "@/server/admin-menu";
import { handle, currentUser } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => ({ items: await listAdminMenu(await getDb(), await currentUser()) }));
}
