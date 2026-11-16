import { db } from "./db";
import { startOfDay } from "./demoData";
import { DATA_DAY_KEY } from "./meta";

/**
 * Keeps the demo "today" fresh. Stored timestamps (orders, shifts, cash movements) are moved forward by
 * the whole local days that passed since the data was last aligned, so the open shift, kitchen tickets
 * and "Hari ini" reports are current and every time of day is preserved. Anything that would land in the
 * future (opened late in the day, visited early the next) is capped at `now`; the cap keeps the order of
 * events intact.
 */
export async function redateToToday(now = Date.now()): Promise<void> {
  const today = startOfDay(now);
  await db.transaction("rw", [db.orders, db.shifts, db.cash_movements, db.meta], async () => {
    const stored = await db.meta.get(DATA_DAY_KEY);
    const delta = stored ? today - stored.value : 0;
    if (delta > 0) {
      const move = (ts: number) => Math.min(ts + delta, now);
      await db.orders.toCollection().modify((order) => {
        order.createdAt = move(order.createdAt);
        if (order.paidAt !== undefined) order.paidAt = move(order.paidAt);
      });
      await db.shifts.toCollection().modify((shift) => {
        shift.openedAt = move(shift.openedAt);
        if (shift.closedAt !== undefined) shift.closedAt = move(shift.closedAt);
      });
      await db.cash_movements.toCollection().modify((movement) => {
        movement.createdAt = move(movement.createdAt);
      });
    }
    if (!stored || delta > 0) await db.meta.put({ key: DATA_DAY_KEY, value: today });
  });
}
