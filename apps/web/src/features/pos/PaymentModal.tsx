import { useId, useState, type ReactNode } from "react";
import { Banknote, CreditCard, QrCode, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import type { PayMethod } from "@wakro/shared";
import type { OrderRow } from "../../types/domain";
import { tableLabel } from "../../lib/orderStatus";
import { useAuth } from "../../state/auth";
import { payOrder, useCart } from "../../state/cart";
import { settleOrder, useNextOrderNo } from "../../state/orders";
import { usePrint } from "../../state/print";
import { useCashShiftOpen } from "../../state/shift";
import { STORE_PROFILE } from "../../lib/storeProfile";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal, ModalFooter, ModalHeader } from "../../ui/Modal";
import { cn } from "../../lib/cn";

/**
 * Takes payment either for the current cart (new order) or, when `order` is given, for an existing
 * unpaid order (self-order / waiter order settled at the register). Settlement is idempotent server-side.
 */
export function PaymentModal({ open, onClose, order }: { open: boolean; onClose: () => void; order?: OrderRow }) {
  return open ? <PaymentDialog onClose={onClose} order={order} /> : null;
}

function PaymentDialog({ onClose, order }: { onClose: () => void; order?: OrderRow }) {
  const { totals } = useCart();
  const orderNo = useNextOrderNo();
  const { currentStaff } = useAuth();
  const { printOrderReceipt } = usePrint();
  const [submitting, setSubmitting] = useState(false);
  const cashOpen = useCashShiftOpen();
  const [method, setMethod] = useState<PayMethod>(cashOpen ? "tunai" : "kartu-qr");
  const [cash, setCash] = useState("");
  const statusId = useId();
  const amount = order ? order.total : totals.total;
  const displayNo = order ? order.no : orderNo;

  const cashNum = Number.parseInt(cash.replace(/\D/g, ""), 10) || 0;
  const shortage = Math.max(0, amount - cashNum);
  const change = cashNum >= amount ? cashNum - amount : null;
  const canPay = (method !== "tunai" || (cashOpen && cashNum >= amount)) && !submitting;

  const handlePay = async () => {
    if (!canPay) return;
    setSubmitting(true);
    try {
      const cashReceived = method === "tunai" ? cashNum : undefined;
      const result = order
        ? await settleOrder(order.no, method, currentStaff.name, cashReceived)
        : { ...(await payOrder(method, cashReceived)), alreadyPaid: false };
      const paid = result.order;
      const printAction = {
        label: t.pos.payment.printReceipt,
        onClick: () => {
          printOrderReceipt(paid).catch((err: unknown) =>
            toast.error(err instanceof Error ? err.message : t.pos.payment.printFailed),
          );
        },
      };
      if (result.alreadyPaid) {
        toast.info(t.pos.payment.alreadyPaidTitle(paid.no), {
          description: t.pos.payment.alreadyPaidBody,
          action: printAction,
        });
      } else {
        toast.success(t.pos.payment.successTitle, {
          description:
            result.change !== null
              ? `${t.pos.payment.successDesc(paid.no, formatIDR(paid.total))} · ${t.pos.payment.successWithChange(formatIDR(result.change))}`
              : t.pos.payment.successDesc(paid.no, formatIDR(paid.total)),
          action: printAction,
          duration: 8000,
        });
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.pos.payment.failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader
        title={t.pos.payment.title}
        subtitle={`${t.pos.payment.orderLabel(displayNo)}${order ? ` · ${tableLabel(order)}` : ""}`}
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="px-6 pt-4">
          <p className="label-caps text-xs2 font-medium text-text-muted">{t.pos.payment.amountLabel}</p>
          <p className="font-display text-4xl font-bold tracking-tight text-ink">{formatIDR(amount)}</p>
        </div>

        <div role="group" aria-label={t.pos.payment.methodsLabel} className="grid grid-cols-1 gap-2 px-6 pt-4 sm:grid-cols-3">
          <MethodCard
            selected={method === "kartu-qr"}
            onSelect={() => setMethod("kartu-qr")}
            icon={<CreditCard size={20} aria-hidden="true" />}
            title={t.pos.payment.cardMethod}
            hint={t.pos.payment.cardHint}
          />
          <MethodCard
            selected={method === "qris"}
            onSelect={() => setMethod("qris")}
            icon={<Wallet size={20} aria-hidden="true" />}
            title={t.pos.payment.qrisMethod}
            hint={t.pos.payment.qrisHint}
          />
          <MethodCard
            selected={method === "tunai"}
            onSelect={() => setMethod("tunai")}
            icon={<Banknote size={20} aria-hidden="true" />}
            title={t.pos.payment.cashMethod}
            hint={cashOpen ? t.pos.payment.cashHint : t.pos.payment.cashNeedsShift}
            disabled={!cashOpen}
          />
        </div>

        {method === "tunai" && cashOpen && (
          <div className="px-6 pt-4">
            <Input
              label={t.pos.payment.cashReceivedLabel}
              size="lg"
              inputMode="numeric"
              autoComplete="off"
              value={cash}
              onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
              placeholder={t.pos.payment.cashPlaceholder}
              aria-describedby={statusId}
              className="font-display font-bold"
            />
            <p id={statusId} aria-live="polite" className="min-h-11 pt-2 text-sm">
              {cash.length > 0 && shortage > 0 && (
                <>
                  <span className="font-semibold text-error-dark">{t.pos.payment.shortageLabel(formatIDR(shortage))}</span>
                  {cashNum > 0 && (
                    <span className="block text-xs text-text-muted">
                      <span className="font-semibold">{t.pos.payment.shortageErrorTitle}</span> ·{" "}
                      {t.pos.payment.shortageErrorBody(formatIDR(amount))}
                    </span>
                  )}
                </>
              )}
              {change !== null && (
                <span className="font-display font-bold text-success-dark">{t.pos.payment.changeLabel(formatIDR(change))}</span>
              )}
            </p>
          </div>
        )}

        {method === "qris" && (
          <div className="px-6 pt-4">
            <div className="flex flex-col items-center rounded-xl border border-border bg-surface p-4 text-center shadow-clay">
              <QrCode size={44} className="text-text-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">{t.pos.payment.qrisScanNote(STORE_PROFILE.outlet)}</p>
              <p className="mt-1 text-xs text-text-muted">{t.pos.payment.qrisSimulated}</p>
            </div>
          </div>
        )}

        {method === "kartu-qr" && (
          <p className="flex items-center gap-2 px-6 pt-4 text-sm text-text-muted">
            <QrCode size={16} aria-hidden="true" />
            {t.pos.payment.cardHint}
          </p>
        )}
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button size="lg" disabled={!canPay} loading={submitting} onClick={() => void handlePay()}>
          {t.pos.payment.complete}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function MethodCard({
  selected,
  onSelect,
  icon,
  title,
  hint,
  disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "pressable flex min-h-32 flex-col justify-between rounded-xl border p-4 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-border bg-surface-muted/60"
          : selected
            ? "border-accent bg-accent/15 ring-2 ring-accent/50"
            : "border-border bg-surface hover:border-accent/50 hover:bg-surface-muted/50",
      )}
    >
      <span className={disabled ? "text-text-muted" : "text-ink"}>{icon}</span>
      <span className={cn("mt-2 block text-sm font-semibold", disabled ? "text-text-muted" : "text-ink")}>{title}</span>
      <span className={cn("mt-0.5 block text-xs2 leading-snug", disabled ? "font-semibold text-warning-dark" : "text-text-muted")}>{hint}</span>
    </button>
  );
}
