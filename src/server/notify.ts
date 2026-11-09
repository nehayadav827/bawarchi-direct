import type { Db } from "@/db/client";
import { notifications } from "@/db/schema";

/**
 * Simulated WhatsApp message (assumption A5). Order and party updates are service messages.
 * Marketing messages would need the customer's opt-in; none are sent.
 */
export async function notify(db: Db, userId: string, orderId: string | null, message: string, channel: "WHATSAPP" | "SMS" = "WHATSAPP") {
  await db.insert(notifications).values({ userId, orderId, channel, message });
}
