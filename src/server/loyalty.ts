import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { loyaltyLedger } from "@/db/schema";
import { EARN_PAISE_PER_POINT, POINT_VALUE_PAISE, MAX_REDEEM_SHARE } from "@/domain/loyalty";

export async function loyaltyBalance(db: Db, userId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${loyaltyLedger.points}), 0)::int` }).from(loyaltyLedger).where(eq(loyaltyLedger.userId, userId));
  return r?.n ?? 0;
}

export async function loyaltySummary(db: Db, userId: string) {
  const history = await db.select().from(loyaltyLedger).where(eq(loyaltyLedger.userId, userId)).orderBy(desc(loyaltyLedger.id)).limit(20);
  return {
    balance: await loyaltyBalance(db, userId), history,
    rules: { earnPaisePerPoint: EARN_PAISE_PER_POINT, pointValuePaise: POINT_VALUE_PAISE, maxRedeemShare: MAX_REDEEM_SHARE },
  };
}
