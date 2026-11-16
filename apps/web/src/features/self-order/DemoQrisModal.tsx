import { CheckCircle2 } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { Modal, ModalFooter, ModalHeader } from "../../ui/Modal";

interface DemoQrisModalProps {
  total: number;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Local demo only: there is no payment gateway, so the payment is simulated and labelled as such. */
export function DemoQrisModal({ total, submitting, onConfirm, onClose }: DemoQrisModalProps) {
  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={t.selfOrder.demoQris.title} />
      <div className="flex-1 space-y-3 overflow-y-auto p-5 text-center">
        <p className="text-xs text-text-muted">{t.selfOrder.demoQris.body}</p>
        <p className="font-display text-xl font-bold text-ink">{formatIDR(total)}</p>
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button loading={submitting} onClick={onConfirm}>
          <CheckCircle2 size={16} aria-hidden="true" /> {t.selfOrder.demoQris.confirm}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
