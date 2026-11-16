import { formatIDR } from "../../data/menu";
import type { QrisCharge } from "../../data/public";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { Modal, ModalFooter, ModalHeader } from "../../ui/Modal";

interface QrisModalProps {
  orderNo: number;
  charge: QrisCharge | null;
  image: string;
  onClose: () => void;
}

/** Gateway QRIS code for a placed order; closes itself when the order turns paid. */
export function QrisModal({ orderNo, charge, image, onClose }: QrisModalProps) {
  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={t.selfOrder.qris.title(orderNo)} subtitle={t.selfOrder.qris.subtitle} />
      <div className="flex-1 overflow-y-auto p-5 text-center">
        <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-ink/20 bg-surface p-2 shadow-clay">
          {image ? (
            <img src={image} alt={t.selfOrder.qris.imageAlt} className="h-60 w-60" />
          ) : (
            <span role="status" className="animate-pulse text-xs text-text-muted">
              {t.selfOrder.qris.generating}
            </span>
          )}
        </div>
        {charge && (
          <>
            <p className="mt-4 font-display text-xl font-bold text-ink">{formatIDR(charge.amount)}</p>
            <p className="mt-1 text-xs2 text-text-muted">
              {t.selfOrder.qris.validUntil(new Date(charge.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }))}
            </p>
          </>
        )}
      </div>
      <ModalFooter className="justify-center">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t.selfOrder.qris.closeToCashier}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
