import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { menuItems } from "@/db/schema";
import { getMenuForOutlet, setOutletItemAvailability } from "@/server/menu";
import { requireRole } from "@/server/auth";
import { HttpError } from "@/server/errors";
import { handle, readJson, currentUser } from "@/server/http";

const staff = ["kitchen", "manager", "admin"] as const;
const schema = z.object({ itemId: z.string().min(1), available: z.boolean() });

export function GET(_req: Request, { params }: { params: Promise<{ outletId: string }> }) {
  return handle(async () => {
    const { outletId } = await params;
    requireRole(await currentUser(), [...staff], outletId);
    const { items } = await getMenuForOutlet(await getDb(), outletId);
    return { items: items.map((i) => ({ id: i.id, name: i.name, veg: i.veg, category: i.category, unavailable: i.unavailable })) };
  });
}

/** Out of stock: pausing an item hides it from ordering at this outlet only. */
export function POST(req: Request, { params }: { params: Promise<{ outletId: string }> }) {
  return handle(async () => {
    const { outletId } = await params;
    requireRole(await currentUser(), [...staff], outletId);
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new HttpError(422, "INVALID_INPUT", "itemId and available are required");
    const db = await getDb();
    const [item] = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.id, p.data.itemId));
    if (!item) throw new HttpError(404, "ITEM_NOT_FOUND");
    await setOutletItemAvailability(db, outletId, p.data.itemId, p.data.available);
    return { ok: true };
  });
}
