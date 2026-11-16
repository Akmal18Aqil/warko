import { useState } from "react";
import { toast } from "sonner";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { deleteCashMovement } from "../../state/shift";
import type { CashMovementRow } from "../../types/domain";
import { Button } from "../../ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { errorMessage } from "./format";

interface DeleteMovementModalProps {
  movement: CashMovementRow;
  onClose: () => void;
}

export function DeleteMovementModal({ movement, onClose }: DeleteMovementModalProps) {
  const text = t.cashDrawer.deleteModal;
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await deleteCashMovement(movement.id);
      toast.success(t.cashDrawer.toast.movementDeleted);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t.cashDrawer.toast.movementDeleteFailed));
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={text.title} />
      <ModalBody>
        <p className="text-sm text-ink-soft">{text.body(movement.description, formatIDR(movement.amount))}</p>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button variant="danger" size="sm" loading={deleting} onClick={confirm}>
          {text.confirm}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
