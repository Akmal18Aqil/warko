import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { isRemoteDataSource } from "../../data/index";
import { formatIDR } from "../../data/menu";
import { playDrawerBeep } from "../../lib/audioFeedback";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import { openShift } from "../../state/shift";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { DEFAULT_STARTING_CASH } from "./constants";
import { errorMessage, formatAmountInput, parseAmount } from "./format";

export function OpenShiftModal({ onClose }: { onClose: () => void }) {
  const text = t.cashDrawer.openShiftModal;
  const { currentStaff } = useAuth();
  const [cashierName, setCashierName] = useState(currentStaff.name);
  const [startingCash, setStartingCash] = useState(DEFAULT_STARTING_CASH.toLocaleString("id-ID"));
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      // The server records the signed-in staff member as cashier, so the name is only asked for locally.
      const saved = await openShift(
        isRemoteDataSource ? currentStaff.name : cashierName.trim() || currentStaff.name,
        parseAmount(startingCash),
      );
      playDrawerBeep();
      toast.success(t.cashDrawer.toast.shiftOpened(saved.cashierName, formatIDR(saved.startingCash)));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t.cashDrawer.toast.shiftOpenFailed));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader title={text.title} subtitle={text.subtitle} />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          {isRemoteDataSource ? null : (
            <Input
              label={text.cashierName}
              required
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              placeholder={text.cashierPlaceholder}
              className="font-semibold"
            />
          )}
          <Input
            label={text.startingCash}
            type="text"
            inputMode="numeric"
            required
            value={startingCash}
            onChange={(e) => setStartingCash(formatAmountInput(e.target.value))}
            className="font-bold"
          />
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" size="sm" loading={saving} className="font-semibold">
            {text.submit}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
