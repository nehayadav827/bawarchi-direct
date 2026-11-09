import { getDb } from "@/db/client";
import { loyaltySummary } from "@/server/loyalty";
import { requireUser } from "@/server/auth";
import { handle, currentUser } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => loyaltySummary(await getDb(), requireUser(await currentUser()).id));
}
