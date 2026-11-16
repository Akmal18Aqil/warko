import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrders } from "../../state/orders";
import { loadPublicOrder } from "../../data/public";
import type { OrderRow, TableRow } from "../../types/domain";
import { readTracked, writeTracked, type TrackedOrder } from "./trackedOrders";

const POLL_MS = 5000;

/**
 * The orders this device placed, newest first. Remote customers poll their own orders by secret key
 * (skipping hidden tabs); local mode reads the shared order state.
 */
export function useLiveOrders(isPublicCustomer: boolean, currentTable: TableRow | null) {
  const orders = useOrders();
  const [tracked, setTracked] = useState<TrackedOrder[]>(readTracked);
  const [remoteOrders, setRemoteOrders] = useState<Record<number, OrderRow>>({});

  const refresh = useCallback(async () => {
    if (!isPublicCustomer || tracked.length === 0) return;
    const results = await Promise.allSettled(tracked.map((entry) => loadPublicOrder(entry.no, entry.key)));
    setRemoteOrders((prev) => {
      const next = { ...prev };
      results.forEach((result, i) => {
        if (result.status === "fulfilled") next[tracked[i].no] = result.value;
      });
      return next;
    });
  }, [isPublicCustomer, tracked]);

  useEffect(() => {
    if (!isPublicCustomer) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isPublicCustomer, refresh]);

  const live: OrderRow[] = useMemo(
    () =>
      tracked
        .filter((entry) => !currentTable || entry.tableId === currentTable.id)
        .map((entry) => (isPublicCustomer ? remoteOrders[entry.no] : orders.find((o) => o.no === entry.no)))
        .filter((order): order is OrderRow => order !== undefined)
        .sort((a, b) => b.no - a.no),
    [tracked, currentTable, isPublicCustomer, orders, remoteOrders],
  );

  const track = useCallback(
    (entry: TrackedOrder, order: OrderRow) => {
      const next = [entry, ...tracked.filter((existing) => existing.no !== entry.no)];
      setTracked(next);
      writeTracked(next);
      if (isPublicCustomer) setRemoteOrders((prev) => ({ ...prev, [order.no]: order }));
    },
    [isPublicCustomer, tracked],
  );

  const keyOf = useCallback((no: number) => tracked.find((entry) => entry.no === no)?.key, [tracked]);

  return { live, track, keyOf };
}
