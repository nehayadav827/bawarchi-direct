import { getDb } from "@/db/client";
import { suggestReorders } from "@/server/suggestions";
import { requireUser } from "@/server/auth";
import { HttpError } from "@/server/errors";
import { handle, currentUser } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const user = requireUser(await currentUser());
    const outletId = new URL(req.url).searchParams.get("outletId");
    if (!outletId) throw new HttpError(422, "INVALID_INPUT", "outletId is required");
    return { suggestions: await suggestReorders(await getDb(), user, outletId) };
  });
}
