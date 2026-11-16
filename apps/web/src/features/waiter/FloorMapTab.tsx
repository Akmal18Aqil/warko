import { ArrowRight } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { isHandledBy } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import { useTables } from "../../state/catalog";
import type { OrderRow } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";

interface FloorMapTabProps {
  activeOrders: ReadonlyMap<string, OrderRow>;
  onOpenTable: (tableId: string) => void;
}

/** Tab 3: every table with its occupancy and the waiter responsible. */
export function FloorMapTab({ activeOrders, onOpenTable }: FloorMapTabProps) {
  const { currentStaff } = useAuth();
  const tables = useTables();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-clay">
        <div>
          <h3 className="font-display text-base font-bold text-ink">{t.waiter.floorTitle}</h3>
          <p className="mt-0.5 text-xs text-text-muted">{t.waiter.floorHint}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="success" className="gap-1 py-1 text-xs font-bold">
            <span className="h-2 w-2 rounded-full bg-success-dark" aria-hidden="true" />
            {t.waiter.tableEmpty}
          </Badge>
          <Badge tone="warning" className="gap-1 py-1 text-xs font-bold">
            <span className="h-2 w-2 rounded-full bg-warning-dark" aria-hidden="true" />
            {t.waiter.tableOccupied}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((table) => {
          const order = activeOrders.get(table.id);
          const isMine = order !== undefined && isHandledBy(order, currentStaff);
          return (
            <div
              key={table.id}
              className={cn(
                "flex flex-col justify-between rounded-2xl border p-4 shadow-clay transition-all",
                order ? (isMine ? "border-success/50 bg-success/10" : "border-warning/60 bg-warning/10") : "border-ink/10 bg-surface",
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-sm font-bold text-ink">{table.name}</h4>
                  <span className="text-xs font-medium text-text-muted">{t.waiter.area(table.area)}</span>
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <Badge tone={order && !isMine ? "warning" : "success"} className="rounded-md font-bold">
                    {order ? t.waiter.tableOccupied : t.waiter.tableEmpty}
                  </Badge>
                  <span className="text-xs text-text-muted">{t.waiter.seats(table.seats)}</span>
                </div>

                {order && (
                  <div className="mt-3 space-y-1 rounded-xl border border-ink/10 bg-surface p-2.5 text-xs">
                    <p className="font-bold text-ink">{t.waiter.floorOrder(order.no, order.customerName ?? t.waiter.guestFallback)}</p>
                    <p className="text-xs2 text-text-muted">
                      {t.waiter.floorHandledBy} <strong className="text-ink">{order.waiterName || t.waiter.guestFallback}</strong>
                    </p>
                    <p className="text-xs2 text-text-muted">{t.waiter.floorTotal(formatIDR(order.total), order.itemCount)}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-border/60 pt-2">
                <Button
                  variant={order ? "outline" : "primary"}
                  size="sm"
                  className="w-full text-xs font-bold"
                  onClick={() => onOpenTable(table.id)}
                >
                  {order ? t.waiter.floorOpenTable : t.waiter.floorOrderTable}
                  <ArrowRight size={13} aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
