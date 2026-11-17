import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { floorsOf } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import { selectTable, setGuests, setOrderType, useCart } from "../../state/cart";
import { useTables } from "../../state/catalog";
import { Select } from "../../ui/Input";

/** Dine-in / takeaway switch with the table picker and guest counter. */
export function OrderTypeSelector() {
  const { orderType, tableId, selectedTable, guests } = useCart();
  const tables = useTables();

  return (
    <>
      <fieldset className="mt-2.5 grid min-w-0 grid-cols-2 gap-1.5 rounded-md bg-surface-muted p-1">
        <legend className="sr-only">{t.pos.cart.orderTypeLabel}</legend>
        <TypeToggle active={orderType === "bawa-pulang"} label={t.pos.cart.takeaway} onClick={() => setOrderType("bawa-pulang")} />
        <TypeToggle
          active={orderType === "meja"}
          label={selectedTable ? t.pos.cart.dineInTable(selectedTable.name) : t.pos.cart.dineIn}
          onClick={() => setOrderType("meja")}
        />
      </fieldset>

      <div className="mt-2 flex items-center justify-between gap-2 pt-0.5">
        {orderType === "meja" ? (
          <Select
            size="sm"
            aria-label={t.pos.cart.chooseTable}
            value={tableId ?? ""}
            onChange={(e) => {
              const table = tables.find((tbl) => tbl.id === e.target.value);
              if (table) selectTable(table);
            }}
            wrapperClassName="min-w-0 flex-1 max-w-48"
            className="h-8 min-h-8 font-bold"
          >
            <option value="" disabled>
              {t.pos.cart.tablePlaceholder}
            </option>
            {floorsOf(tables).map((floor) => (
              <optgroup key={floor} label={floor}>
                {tables
                  .filter((tbl) => tbl.area === floor && tbl.active !== false)
                  .map((tbl) => (
                    <option key={tbl.id} value={tbl.id}>
                      {tbl.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        ) : (
          <span className="text-xs font-medium text-text-muted">{t.pos.cart.takeawayNote}</span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs font-bold text-text-muted">{t.pos.cart.guestsLabel}:</span>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-mineral/50 p-0.5">
            <QtyButton label={t.pos.cart.guestsDecrease} onClick={() => setGuests(Math.max(1, guests - 1))}>
              <Minus size={11} strokeWidth={2.6} aria-hidden="true" />
            </QtyButton>
            <span className="min-w-6 text-center font-display text-xs font-bold text-ink">{guests}</span>
            <QtyButton label={t.pos.cart.guestsIncrease} onClick={() => setGuests(guests + 1)}>
              <Plus size={11} strokeWidth={2.6} aria-hidden="true" />
            </QtyButton>
          </div>
        </div>
      </div>
    </>
  );
}

function TypeToggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "pressable h-8 rounded-lg text-xs font-semibold transition-all",
        active ? "bg-accent font-bold text-white shadow-xs" : "text-text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

export function QtyButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="pressable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ink transition-colors hover:border-border-hover hover:bg-mineral/40"
    >
      {children}
    </button>
  );
}
