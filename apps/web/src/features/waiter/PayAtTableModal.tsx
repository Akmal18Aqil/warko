import { useState } from "react";
import { Banknote, QrCode } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import type { WaiterPayMethod } from "./constants";

interface PayAtTableModalProps {
  tableName: string;
  waiterName: string;
  total: number;
  isSubmitting: boolean;
  onClose: () => void;
  /** Resolves true when the order was stored and paid; the modal then closes itself. */
  onConfirm: (payment: { method: WaiterPayMethod; cashReceived?: number }) => Promise<boolean>;
}

const METHODS: readonly { id: WaiterPayMethod; label: string; icon: typeof Banknote }[] = [
  { id: "tunai", label: t.waiter.methodCash, icon: Banknote },
  { id: "qris", label: t.waiter.methodQris, icon: QrCode },
];

export function PayAtTableModal({ tableName, waiterName, total, isSubmitting, onClose, onConfirm }: PayAtTableModalProps) {
  const [method, setMethod] = useState<WaiterPayMethod>("tunai");
  const [cashInput, setCashInput] = useState("");

  const confirm = async () => {
    const cashReceived = Number.parseInt(cashInput, 10) || 0;
    const paid = await onConfirm({ method, cashReceived: method === "tunai" ? cashReceived : undefined });
    if (paid) onClose();
  };

  return (
    <Modal size="sm" onClose={onClose}>
      <ModalHeader title={t.waiter.payTitle(tableName)} subtitle={t.waiter.paySubtitle(waiterName)} />
      <ModalBody className="space-y-4">
        <div className="space-y-1 rounded-xl bg-mineral p-3 text-center">
          <span className="text-xs text-text-muted">{t.waiter.payDue}</span>
          <p className="font-display text-2xl font-bold text-ink">{formatIDR(total)}</p>
        </div>

        <div role="radiogroup" aria-label={t.waiter.payMethodLabel} className="grid grid-cols-2 gap-2">
          {METHODS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={method === id}
              onClick={() => setMethod(id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all",
                method === id
                  ? "border-ink bg-ink text-white shadow-sm"
                  : "border-border bg-surface text-ink hover:bg-mineral",
              )}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {method === "tunai" ? (
          <Input
            label={t.waiter.payCashReceived}
            inputMode="numeric"
            autoComplete="off"
            value={cashInput}
            onChange={(e) => setCashInput(e.target.value.replace(/\D/g, ""))}
            placeholder={String(total)}
            className="font-bold"
          />
        ) : (
          <p className="rounded-xl bg-warning/10 p-2.5 text-xs2 font-semibold text-warning-dark">
            {t.waiter.payQrisNotice}
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button variant="primary" className="font-bold" onClick={confirm} loading={isSubmitting}>
          {t.waiter.payConfirm}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
