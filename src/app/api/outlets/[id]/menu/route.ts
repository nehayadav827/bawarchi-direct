import { getDb } from "@/db/client";
import { getMenuForOutlet } from "@/server/menu";
import { handle } from "@/server/http";
import { GST_RATE_PERCENT } from "@/domain/money";

export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { outlet, items } = await getMenuForOutlet(await getDb(), id);
    return {
      outlet: { id: outlet.id, name: outlet.name, city: outlet.city, fssai: outlet.fssai, kind: outlet.kind, minPrepMinutes: outlet.minPrepMinutes },
      gstRatePercent: GST_RATE_PERCENT, pricesIncludeGst: true, items,
    };
  });
}
