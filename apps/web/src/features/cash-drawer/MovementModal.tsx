import type { CashMovementCategory, CashMovementType } from "@wakro/shared";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { playDrawerBeep } from "../../lib/audioFeedback";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import { addCashMovement } from "../../state/shift";
import { Button } from "../../ui/Button";
import { Input, Select, Textarea } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { CATEGORIES_BY_TYPE, DEFAULT_CATEGORY, MOVEMENT_TYPES, QUICK_AMOUNTS } from "./constants";
import { errorMessage, formatAmountInput, parseAmount } from "./format";

interface MovementModalProps {
  initialType: CashMovementType;
  onClose: () => void;
}

const TYPE_ACTIVE: Record<CashMovementType, string> = {
  CASH_IN: "bg-success-dark text-white shadow-sm",
  CASH_OUT: "bg-error-dark text-white shadow-sm",
};

export function MovementModal({ initialType, onClose }: MovementModalProps) {
  const text = t.cashDrawer.movementModal;
  const { currentStaff } = useAuth();
  const [type, setType] = useState(initialType);
  const [category, setCategory] = useState<CashMovementCategory>(DEFAULT_CATEGORY[initialType]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const incoming = type === "CASH_IN";

  const chooseType = (next: CashMovementType) => {
    setType(next);
    setCategory(DEFAULT_CATEGORY[next]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value <= 0) {
      toast.error(t.cashDrawer.toast.amountInvalid);
      return;
    }
    if (!description.trim()) {
      toast.error(t.cashDrawer.toast.descriptionRequired);
      return;
    }
    setSaving(true);
    try {
      await addCashMovement({ type, category, amount: value, description: description.trim(), cashierName: currentStaff.name });
      playDrawerBeep();
      toast.success(t.cashDrawer.toast.movementSaved(type, formatIDR(value)));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t.cashDrawer.toast.movementFailed));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader title={incoming ? text.titleIn : text.titleOut} subtitle={incoming ? text.subtitleIn : text.subtitleOut} />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          <div role="radiogroup" aria-label={text.typeLabel} className="grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-mineral/80 p-1">
            {MOVEMENT_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={type === option}
                onClick={() => chooseType(option)}
                className={cn(
                  "rounded-lg py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  type === option ? TYPE_ACTIVE[option] : "text-text-muted hover:text-ink",
                )}
              >
                {t.cashDrawer.movementType[option]}
              </button>
            ))}
          </div>

          <Select label={text.category} value={category} onChange={(e) => setCategory(e.target.value as CashMovementCategory)}>
            {CATEGORIES_BY_TYPE[type].map((option) => (
              <option key={option} value={option}>
                {t.cashDrawer.categories[option]}
              </option>
            ))}
          </Select>

          <div>
            <Input
              label={text.amount}
              type="text"
              inputMode="numeric"
              required
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              placeholder={text.amountPlaceholder}
              className="font-bold"
            />
            <div role="group" aria-label={text.quickAmountsLabel} className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmount(quick.toLocaleString("id-ID"))}
                  className="rounded-lg border border-ink/10 bg-mineral/70 px-2.5 py-1 text-xs font-semibold text-ink-soft transition-colors hover:bg-mineral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {formatIDR(quick)}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label={text.description}
            required
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={incoming ? text.descriptionPlaceholderIn : text.descriptionPlaceholderOut}
          />
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" size="sm" variant={incoming ? "success" : "danger"} loading={saving}>
            {text.submit}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
