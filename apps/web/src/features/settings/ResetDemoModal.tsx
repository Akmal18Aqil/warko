import { useState } from "react";
import { toast } from "sonner";
import { t } from "../../locales/id";
import { resetDemoData } from "../../state/demo";
import { Button } from "../../ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";

/** Confirms wiping every demo record in this browser; a successful reset reloads the page. */
export function ResetDemoModal({ onClose }: { onClose: () => void }) {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetDemoData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.settings.data.resetFailed);
      setResetting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm" closeOnBackdrop={!resetting}>
      <ModalHeader title={t.settings.data.resetTitle} />
      <ModalBody>
        <p className="text-sm text-ink/70">{t.settings.data.resetBody}</p>
      </ModalBody>
      <ModalFooter>
        <Button size="sm" variant="outline" disabled={resetting} onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button size="sm" variant="danger" loading={resetting} onClick={() => void handleReset()}>
          {t.settings.data.resetConfirm}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
