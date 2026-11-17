import { ShoppingBag } from "lucide-react";
import { cn } from "../../lib/cn";
import { floorsOf } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import { selectTable, setOrderType, useCart } from "../../state/cart";
import { useTables } from "../../state/catalog";
import type { TableRow } from "../../types/domain";
import { Modal, ModalHeader } from "../../ui/Modal";

/**
 * Takeaway or a table in one tap. Choosing a table is what makes the order dine-in, so a dine-in
 * order never sits without a table; the order being built moves along (see `selectTable`).
 */
export function OrderTypeSheet({ onClose }: { onClose: () => void }) {
  const { orderType, tableId } = useCart();
  const tables = useTables().filter((table) => table.active !== false);
  const takeaway = orderType === "bawa-pulang";

  const chooseTakeaway = () => {
    setOrderType("bawa-pulang");
    onClose();
  };
  const chooseTable = (table: TableRow) => {
    selectTable(table);
    onClose();
  };

  return (
    <Modal onClose={onClose} placement="sheet" size="md">
      <ModalHeader title={t.pos.orderTypeSheet.title} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        <button
          type="button"
          aria-pressed={takeaway}
          onClick={chooseTakeaway}
          className={cn(
            "pressable flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left",
            takeaway ? "border-accent bg-accent/15 text-accent-dark" : "border-border bg-surface text-ink",
          )}
        >
          <ShoppingBag size={20} aria-hidden="true" />
          <span>
            <span className="block text-sm font-bold">{t.pos.cart.takeaway}</span>
            <span className="block text-xs text-text-muted">{t.pos.orderTypeSheet.takeawayHint}</span>
          </span>
        </button>

        <section aria-labelledby="order-type-dine-in" className="space-y-3">
          <h3 id="order-type-dine-in" className="label-caps text-2xs font-bold text-text-muted">
            {t.pos.orderTypeSheet.dineInHeading}
          </h3>
          {tables.length === 0 && <p className="text-sm text-text-muted">{t.pos.orderTypeSheet.noTables}</p>}
          {floorsOf(tables).map((floor) => (
            <fieldset key={floor} className="min-w-0 space-y-2">
              <legend className="mb-2 text-xs font-semibold text-ink-soft">{floor}</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {tables
                  .filter((table) => table.area === floor)
                  .map((table) => {
                    const selected = orderType === "meja" && table.id === tableId;
                    return (
                      <button
                        key={table.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => chooseTable(table)}
                        className={cn(
                          "pressable flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 text-sm font-bold",
                          selected ? "border-accent bg-accent/15 text-accent-dark" : "border-border bg-surface text-ink",
                        )}
                      >
                        {table.name}
                        <span className="text-2xs font-medium text-text-muted">{t.pos.orderTypeSheet.seats(table.seats)}</span>
                      </button>
                    );
                  })}
              </div>
            </fieldset>
          ))}
        </section>
      </div>
    </Modal>
  );
}
