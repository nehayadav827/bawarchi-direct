import { getDb } from "@/db/client";
import { outletStats } from "@/server/stats";
import { requireUser } from "@/server/auth";
import { handle, currentUser } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const days = Number(new URL(req.url).searchParams.get("days") ?? 7);
    return { days, outlets: await outletStats(await getDb(), requireUser(await currentUser()), days) };
  });
}
