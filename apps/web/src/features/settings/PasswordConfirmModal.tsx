import { ShieldCheck } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { PASSWORD_MAX_LENGTH } from "../../data/authApi";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";

type Props = {
  title: string;
  description: string;
  submitLabel: string;
  danger?: boolean;
  /** Extra fields shown above the password (for example a new PIN). */
  children?: ReactNode;
  /** Blocks submission while the extra fields are invalid. */
  canSubmit?: boolean;
  /** Runs the action with the typed password; throw an `Error` to show its message and keep the dialog open. */
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
};

/**
 * Staff management and security actions always need the acting admin's own password, even in a PIN session.
 * The server verifies it; this dialog only collects it and shows the server's answer.
 */
export function PasswordConfirmModal({
  title,
  description,
  submitLabel,
  danger = false,
  children,
  canSubmit = true,
  onConfirm,
  onClose,
}: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.unknownError);
      setPassword("");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={busy ? () => undefined : onClose} closeOnBackdrop={!busy} closeOnEscape={!busy} size="sm" placement="sheet">
      <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
        <ModalHeader
          title={title}
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-xs">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
          }
        />
        <ModalBody className="space-y-4">
          <p className="text-sm text-ink/70">{description}</p>
          {children}
          <Input
            label={t.settings.staff.confirm.password}
            hint={t.settings.staff.confirm.passwordHint}
            type="password"
            autoComplete="current-password"
            maxLength={PASSWORD_MAX_LENGTH}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm font-medium text-error-dark">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
