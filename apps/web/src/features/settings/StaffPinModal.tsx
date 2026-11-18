import { useState } from "react";
import { PIN_LENGTH, PIN_PATTERN, setStaffPin } from "../../data/authApi";
import { t } from "../../locales/id";
import { Input } from "../../ui/Input";
import { PasswordConfirmModal } from "./PasswordConfirmModal";

type Props = {
  member: { id: string; name: string; hasPin: boolean };
  mode: "set" | "clear";
  onClose: () => void;
  /** Called after the server accepted the change; `selfRevoked` means the acting admin's own session ended. */
  onDone: (result: { selfRevoked: boolean }) => void;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, PIN_LENGTH);

/** Sets, resets or removes a staff PIN. The admin's password is required in every case. */
export function StaffPinModal({ member, mode, onClose, onDone }: Props) {
  const text = t.settings.staff.pin;
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const clearing = mode === "clear";

  const format = !clearing && pin.length > 0 && !PIN_PATTERN.test(pin) ? text.invalid : "";
  const mismatch = !clearing && repeat.length > 0 && pin !== repeat ? text.mismatch : "";
  const canSubmit = clearing || (PIN_PATTERN.test(pin) && pin === repeat);

  return (
    <PasswordConfirmModal
      title={clearing ? text.clearTitle(member.name) : member.hasPin ? text.resetTitle(member.name) : text.setTitle(member.name)}
      description={clearing ? text.clearBody : text.setBody}
      submitLabel={clearing ? text.submitClear : text.submitSet}
      danger={clearing}
      canSubmit={canSubmit}
      onClose={onClose}
      onConfirm={async (password) => onDone(await setStaffPin(member.id, clearing ? null : pin, password))}
    >
      {!clearing && (
        <>
          <Input
            label={text.pin}
            hint={text.pinHint}
            error={format}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH}
            required
            value={pin}
            onChange={(event) => setPin(digitsOnly(event.target.value))}
          />
          <Input
            label={text.pinRepeat}
            error={mismatch}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH}
            required
            value={repeat}
            onChange={(event) => setRepeat(digitsOnly(event.target.value))}
          />
        </>
      )}
    </PasswordConfirmModal>
  );
}
