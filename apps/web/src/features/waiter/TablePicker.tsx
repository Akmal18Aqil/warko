import { AlertCircle, Users } from "lucide-react";
import { useId } from "react";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { isHandledBy, isPaid, KITCHEN_LABEL, kitchenStatusOf } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import { useTables } from "../../state/catalog";
import type { OrderRow } from "../../types/domain";
import { Input } from "../../ui/Input";
import { GUEST_OPTIONS } from "./constants";
import { waiterFirstName } from "./tableOccupancy";
import type { WaiterDraft } from "./useWaiterDraft";

interface TablePickerProps {
  draft: WaiterDraft;
  activeOrders: ReadonlyMap<string, OrderRow>;
}

/** Table chips with live occupancy, guest count and customer name for the order being taken. */
export function TablePicker({ draft, activeOrders }: TablePickerProps) {
  const { currentStaff } = useAuth();
  const tables = useTables();
  const guestsLabelId = useId();
  const { selectedTable } = draft;
  const selectedOrder = selectedTable ? activeOrders.get(selectedTable.id) : undefined;

  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-clay">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
            <Users size={16} aria-hidden="true" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">{t.waiter.pickTable}</span>
            <span className="ml-2 text-xs2 font-medium text-text-muted">{t.waiter.pickTableHint}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span id={guestsLabelId} className="text-xs font-medium text-text-muted">
            {t.waiter.guestsLabel}
          </span>
          <div role="radiogroup" aria-labelledby={guestsLabelId} className="flex items-center gap-1">
            {GUEST_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={draft.guests === count}
                aria-label={t.waiter.guestsOption(count)}
                onClick={() => draft.setGuests(count)}
                className={cn(
                  "h-7 w-7 rounded-lg text-xs font-bold transition-all",
                  draft.guests === count ? "bg-accent text-white shadow-xs" : "bg-surface-muted text-text-muted hover:bg-border",
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div role="group" aria-label={t.waiter.tablesLabel} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {tables.map((table) => {
          const order = activeOrders.get(table.id);
          const isSelected = table.id === selectedTable?.id;
          const isMine = order !== undefined && isHandledBy(order, currentStaff);
          return (
            <button
              key={table.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => draft.setSelectedTableId(table.id)}
              className={cn(
                "relative flex min-h-14 flex-col items-start justify-between rounded-xl border p-2.5 text-left text-xs font-bold transition-all",
                isSelected
                  ? "border-ink bg-accent text-white shadow-md ring-2 ring-accent"
                  : isMine
                    ? "border-success/50 bg-success/10 text-success-dark hover:bg-success/20"
                    : order
                      ? "border-warning/60 bg-warning/10 text-warning-dark hover:bg-warning/20"
                      : "border-border bg-mineral text-ink/80 hover:bg-surface-muted",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-bold">{table.name}</span>
                <span className="text-2xs opacity-60">{table.area}</span>
              </div>
              <div className="mt-1 flex w-full items-center justify-between">
                {order ? (
                  <span
                    className={cn(
                      "line-clamp-1 rounded px-1.5 py-0.5 text-2xs font-bold",
                      isSelected ? "bg-accent text-white" : isMine ? "bg-success/30 text-success-dark" : "bg-warning/30 text-warning-dark",
                    )}
                  >
                    {isMine ? t.waiter.occupiedByMe(order.no) : t.waiter.occupiedByOther(waiterFirstName(order), order.no)}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-2xs font-semibold",
                      isSelected ? "bg-white/20 text-white" : "bg-success/20 text-success-dark",
                    )}
                  >
                    {t.waiter.tableEmpty}
                  </span>
                )}
                <span className="text-2xs opacity-50">{t.waiter.seats(table.seats)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedTable && selectedOrder ? (
        <TableOccupancyNotice tableName={selectedTable.name} order={selectedOrder} mine={isHandledBy(selectedOrder, currentStaff)} />
      ) : null}

      <Input
        label={t.waiter.customerNameLabel}
        value={draft.customerName}
        onChange={(e) => draft.setCustomerName(e.target.value)}
        placeholder={t.waiter.customerNamePlaceholder}
        size="sm"
      />
    </div>
  );
}

function TableOccupancyNotice({ tableName, order, mine }: { tableName: string; order: OrderRow; mine: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border p-3",
        mine ? "border-success/50 bg-success/10 text-success-dark" : "border-warning/60 bg-warning/10 text-warning-dark",
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold">
            {mine
              ? t.waiter.noticeMine(tableName, order.no)
              : t.waiter.noticeOther(tableName, order.waiterName || order.customerName || t.waiter.guestFallback, order.no)}
          </p>
          <p className="mt-0.5 text-xs2 opacity-80">
            {t.waiter.noticeKitchen}{" "}
            <strong>
              {KITCHEN_LABEL[kitchenStatusOf(order)]} · {isPaid(order) ? t.waiter.noticePaid : t.waiter.noticeUnpaid}
            </strong>{" "}
            · {t.waiter.noticeItems(order.itemCount, formatIDR(order.total))}
          </p>
        </div>
      </div>
      <span className="shrink-0 rounded border border-border bg-surface/80 px-2 py-1 text-2xs font-bold">
        {mine ? t.waiter.badgeMine : t.waiter.badgeOther}
      </span>
    </div>
  );
}
