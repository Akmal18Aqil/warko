import { ReceiptText } from "lucide-react";
import { Modal, ModalFooter } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { OrderReceiptView } from "../printing/OrderReceiptView";
import { t } from "../../locales/id";
import type { OrderRow } from "../../types/domain";

interface ReceiptModalProps {
  order: OrderRow;
  onClose: () => void;
  onPrint: () => void;
}

/** Digital receipt (e-struk) with save/print. */
export function ReceiptModal({ order, onClose, onPrint }: ReceiptModalProps) {
  return (
    <Modal onClose={onClose} size="sm" ariaLabel={t.selfOrder.receipt.label}>
      <div className="flex-1 overflow-y-auto p-5">
        <OrderReceiptView order={order} />
      </div>
      <ModalFooter>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          {t.common.close}
        </Button>
        <Button className="flex-1" onClick={onPrint}>
          <ReceiptText size={15} aria-hidden="true" /> {t.selfOrder.receipt.print}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
