/**
 * Runs once when the server starts. Schedules the late-order sweep so the 10-minute manager alert and the
 * customer message fire even when no kitchen screen is open. The sweep is idempotent and safe on several instances.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as { __bdSweep?: boolean };
  if (g.__bdSweep) return;
  g.__bdSweep = true;
  const every = Number(process.env.SWEEP_INTERVAL_MS ?? 30000);
  const timer = setInterval(async () => {
    try {
      const { getDb } = await import("@/db/client");
      const { sweepLateOrders } = await import("@/server/orders");
      await sweepLateOrders(await getDb());
    } catch (e) { console.error("late-order sweep failed", e); }
  }, every);
  timer.unref?.();
  console.log(`late-order sweep scheduled every ${every} ms`);
}
