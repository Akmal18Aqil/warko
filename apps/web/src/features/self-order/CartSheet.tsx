import { Banknote, QrCode } from "lucide-react";
import type { PricingSettings } from "@wakro/shared";
import { Modal, ModalHeader } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { formatIDR, type MenuItem } from "../../data/menu";
import { t } from "../../locales/id";
import type { CartLine, OrderTotals, TableRow } from "../../types/domain";
import { QtyStepper } from "./QtyStepper";

interface CartSheetProps {
  lines: CartLine[];
  totals: OrderTotals;
  products: MenuItem[];
  pricing: PricingSettings;
  table: TableRow | null;
  customerName: string;
  /** QRIS is offered (gateway configured, or the local demo simulation). */
  qrisAvailable: boolean;
  /** Local demo mode: the QRIS payment is only simulated. */
  qrisIsDemo: boolean;
  submitting: boolean;
  onClose: () => void;
  onAdd: (itemId: string) => void;
  onDecrease: (itemId: string) => void;
  onSetNote: (itemId: string, note: string) => void;
  onPayQris: () => void;
  onPayCashier: () => void;
}

/** The order review: lines with notes, price breakdown and the two ways to place the order. */
export function CartSheet({
  lines,
  totals,
  products,
  pricing,
  table,
  customerName,
  qrisAvailable,
  qrisIsDemo,
  submitting,
  onClose,
  onAdd,
  onDecrease,
  onSetNote,
  onPayQris,
  onPayCashier,
}: CartSheetProps) {
  const { taxEnabled, taxRate, serviceChargeEnabled, serviceChargeRate } = pricing;
  return (
    <Modal onClose={onClose} placement="sheet" size="md">
      <ModalHeader
        title={t.selfOrder.cart.title(table ? t.selfOrder.header.tableLabel(table.name, table.area) : null)}
        subtitle={t.selfOrder.cart.forName(customerName.trim() || t.selfOrder.guest)}
      />

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {lines.map((line) => {
          const product = products.find((p) => p.id === line.itemId);
          if (!product) return null;
          return (
            <div key={line.itemId} className="rounded-xl border border-border bg-mineral p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-ink">{product.name}</div>
                <div className="font-display text-sm font-bold text-ink">{formatIDR(product.price * line.qty)}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={line.note || ""}
                  maxLength={200}
                  onChange={(e) => onSetNote(line.itemId, e.target.value)}
                  placeholder={t.selfOrder.cart.notePlaceholder}
                  aria-label={t.selfOrder.cart.noteFor(product.name)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <QtyStepper
                  size="sm"
                  name={product.name}
                  qty={line.qty}
                  onDecrease={() => onDecrease(line.itemId)}
                  onIncrease={() => onAdd(line.itemId)}
                />
              </div>
            </div>
          );
        })}

        <div className="space-y-1.5 rounded-xl bg-surface-muted p-3 text-xs">
          <div className="flex justify-between text-ink/70">
            <span>{t.selfOrder.cart.subtotal(totals.count)}</span>
            <span>{formatIDR(totals.rawSubtotal)}</span>
          </div>
          {serviceChargeEnabled && (
            <div className="flex justify-between text-ink/70">
              <span>{t.selfOrder.cart.serviceCharge(serviceChargeRate)}</span>
              <span>{formatIDR(totals.serviceCharge)}</span>
            </div>
          )}
          {taxEnabled && (
            <div className="flex justify-between text-ink/70">
              <span>{t.selfOrder.cart.tax(taxRate)}</span>
              <span>{formatIDR(totals.tax)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-display text-sm font-bold text-ink">
            <span>{t.common.total}</span>
            <span>{formatIDR(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 border-t border-border/60 bg-surface p-4">
        {qrisAvailable && (
          <Button size="lg" className="w-full" onClick={onPayQris} disabled={submitting || !table}>
            <QrCode size={18} aria-hidden="true" />
            {qrisIsDemo ? t.selfOrder.cart.payQrisDemo : t.selfOrder.cart.payQris}
          </Button>
        )}
        <Button
          size="lg"
          variant={qrisAvailable ? "outline" : "primary"}
          className="w-full"
          onClick={onPayCashier}
          disabled={submitting || !table}
        >
          <Banknote size={18} aria-hidden="true" />
          {t.selfOrder.cart.payCashier}
        </Button>
        {!table && <p className="text-center text-xs font-semibold text-error">{t.selfOrder.cart.needTable}</p>}
      </div>
    </Modal>
  );
}
