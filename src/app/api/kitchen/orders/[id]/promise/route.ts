import { z } from "zod";
import { getDb } from "@/db/client";
import { overridePromise } from "@/server/orders";
import { requireUser } from "@/server/auth";
import { HttpError } from "@/server/errors";
import { handle, readJson, currentUser } from "@/server/http";

const schema = z.object({ minutes: z.number().int() });

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const user = requireUser(await currentUser());
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new HttpError(422, "INVALID_INPUT", "Minutes must be a whole number");
    return overridePromise(await getDb(), user, id, p.data.minutes);
  });
}
