import { useEffect, useRef, useState } from "react";
import { Banknote, CreditCard, QrCode, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "../data/menu";
import { t } from "../locales/en";
import type { PayMethod } from "@wakro/shared";
import type { OrderRow } from "../types/domain";
import { tableLabel } from "../lib/orderStatus";
import { useAuth } from "./AuthContext";
import { payOrder, useCart } from "../state/cart";
import { settleOrder, useNextOrderNo } from "../state/orders";
import { usePrint } from "./PrintContext";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";

/**
 * Takes payment either for the current cart (new order) or, when `order` is given, for an existing
 * unpaid order (self-order / waiter order settled at the register). Settlement is idempotent server-side.
 */
export function PaymentModal({ open, onClose, order }: { open: boolean; onClose: () => void; order?: OrderRow }) {
  const { totals } = useCart();
  const orderNo = useNextOrderNo();
  const { currentStaff } = useAuth();
  const { printOrderReceipt } = usePrint();
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<PayMethod>("tunai");
  const [cash, setCash] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const amount = order ? order.total : totals.total;
  const displayNo = order ? order.no : orderNo;

  useEffect(() => {
    if (!open) return;
    setMethod("tunai");
    setCash("");
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const cashNum = Number.parseInt(cash.replace(/\D/g, ""), 10) || 0;
  const shortage = Math.max(0, amount - cashNum);
  const change = cashNum >= amount ? cashNum - amount : null;
  const canPay = (method !== "tunai" || cashNum >= amount) && !submitting;

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
        label: "Cetak struk",
        onClick: () => {
          printOrderReceipt(paid).catch((err: unknown) =>
            toast.error(err instanceof Error ? err.message : "Struk gagal dicetak."),
          );
        },
      };
      if (result.alreadyPaid) {
        toast.info(`Pesanan #${paid.no} sudah lunas sebelumnya`, {
          description: "Tidak ada pembayaran ganda yang dicatat.",
          action: printAction,
        });
      } else {
        toast.success(t.payment.successTitle, {
          description:
            result.change !== null
              ? `${t.payment.successDesc(paid.no, formatIDR(paid.total))} · ${t.payment.successWithChange(formatIDR(result.change))}`
              : t.payment.successDesc(paid.no, formatIDR(paid.total)),
          action: printAction,
          duration: 8000,
        });
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pembayaran gagal disimpan. Pesanan belum tercatat.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between px-6 pt-5">
          <div>
            <p className="label-caps text-[11px] font-semibold text-ink/50">
              {t.payment.orderLabel(displayNo)}
              {order ? ` · ${tableLabel(order)}` : ""}
            </p>
            <h2
              id="payment-title"
              className="mt-1 font-display text-xl font-bold tracking-tight text-ink"
            >
              {t.payment.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t.payment.cancel}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink/60 transition-colors hover:border-accent hover:bg-accent/10 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">

        <div className="px-6 pt-3">
          <p className="label-caps text-[11px] font-medium text-ink/45">
            {t.payment.amountLabel}
          </p>
          <p className="font-display text-4xl font-bold tracking-tight text-ink">
            {formatIDR(amount)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 p-6 pb-0 sm:grid-cols-3">
          <MethodCard
            selected={method === "kartu-qr"}
            onSelect={() => setMethod("kartu-qr")}
            icon={<CreditCard size={20} />}
            title={t.payment.cardMethod}
            hint={t.payment.cardHint}
          />
          <MethodCard
            selected={method === "qris"}
            onSelect={() => setMethod("qris")}
            icon={<Wallet size={20} />}
            title={t.payment.qrisMethod}
            hint={t.payment.qrisHint}
          />
          <MethodCard
            selected={method === "tunai"}
            onSelect={() => setMethod("tunai")}
            icon={<Banknote size={20} />}
            title={t.payment.cashMethod}
            hint={t.payment.cashHint}
          />
        </div>

        {method === "tunai" && (
          <div className="px-6 pt-4">
            <label
              htmlFor="cash-received"
              className="label-caps block text-[11px] font-medium text-ink/50"
            >
              {t.payment.cashReceivedLabel}
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-display text-sm font-bold text-ink/60">
                Rp
              </span>
              <input
                id="cash-received"
                inputMode="numeric"
                autoComplete="off"
                value={cash}
                onChange={(e) => setCash(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={t.payment.cashPlaceholder}
                aria-describedby="cash-status"
                className="h-12 w-full rounded-lg border border-ink/15 bg-white pl-10 pr-3.5 font-display text-lg font-bold tracking-tight text-ink placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-ink/35 focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-accent/60"
              />
            </div>
            <p id="cash-status" aria-live="polite" className="min-h-11 pt-2 text-sm">
              {cash.length > 0 && shortage > 0 && (
                <>
                  <span className="font-semibold text-coral">
                    {t.payment.shortageLabel(formatIDR(shortage))}
                  </span>
                  {cashNum > 0 && (
                    <span className="block text-xs text-ink/55">
                      <span className="font-semibold">{t.payment.shortageErrorTitle}</span>{" "}
                      · {t.payment.shortageErrorBody(formatIDR(amount))}
                    </span>
                  )}
                </>
              )}
              {change !== null && (
                <span className="font-display font-bold text-emerald-700">
                  {t.payment.changeLabel(formatIDR(change))}
                </span>
              )}
            </p>
          </div>
        )}

        {method === "qris" && (
          <div className="px-6 pt-4">
            <div className="flex flex-col items-center rounded-xl border border-ink/10 bg-white p-4 text-center">
              <QrCode size={44} className="text-ink/40" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">
                {t.payment.qrisScanNote}
              </p>
              <p className="mt-1 text-xs text-ink/55">
                {t.payment.qrisSimulated}
              </p>
            </div>
          </div>
        )}

        {method === "kartu-qr" && (
          <p className="flex items-center gap-2 px-6 pt-4 text-sm text-ink/50">
            <QrCode size={16} aria-hidden="true" />
            {t.payment.cardHint}.
          </p>
        )}

        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            {t.payment.cancel}
          </Button>
          <Button size="lg" disabled={!canPay} onClick={() => void handlePay()}>
            {t.payment.complete}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MethodCard({
  selected,
  onSelect,
  icon,
  title,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "pressable flex min-h-32 flex-col justify-between rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-accent bg-accent/15 ring-2 ring-accent/50"
          : "border-border bg-surface hover:border-accent/50 hover:bg-surface-muted/50",
      )}
    >
      <span className="text-ink">{icon}</span>
      <span className="mt-2 block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-ink/50">{hint}</span>
    </button>
  );
}
