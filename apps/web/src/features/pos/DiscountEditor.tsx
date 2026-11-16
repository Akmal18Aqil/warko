import { useState } from "react";
import { toast } from "sonner";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { setDiscount } from "../../state/cart";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";

type DiscountType = "percent" | "fixed";

const TYPES: readonly { id: DiscountType; label: string }[] = [
  { id: "percent", label: t.pos.discount.percent },
  { id: "fixed", label: t.pos.discount.fixed },
];

/** Modal for setting the cart discount as a percentage or a fixed rupiah amount. */
export function DiscountEditor({
  initialType,
  initialValue,
  onClose,
}: {
  initialType: DiscountType;
  initialValue: number;
  onClose: () => void;
}) {
  const [type, setType] = useState<DiscountType>(initialType);
  const [value, setValue] = useState(initialValue > 0 ? String(initialValue) : "");

  const apply = () => {
    const amount = Number.parseInt(value.replace(/\D/g, ""), 10) || 0;
    setDiscount(type, amount);
    onClose();
    if (amount > 0) toast.success(t.pos.discount.applied(type === "percent" ? `${amount}%` : formatIDR(amount)));
    else toast.info(t.pos.discount.removed);
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={t.pos.discount.title} subtitle={t.pos.discount.subtitle} />
      <ModalBody>
        <div role="radiogroup" aria-label={t.pos.discount.typeLabel} className="grid grid-cols-2 gap-2">
          {TYPES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={type === option.id}
              onClick={() => setType(option.id)}
              className={cn(
                "rounded-xl border py-2 text-xs font-bold transition-colors",
                type === option.id ? "border-accent-dark bg-accent text-white shadow-xs" : "border-border text-text-muted hover:bg-ink/5",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Input
          wrapperClassName="mt-3"
          label={t.pos.discount.valueLabel(type)}
          type="number"
          min="0"
          max={type === "percent" ? "100" : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.pos.discount.placeholder(type)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
        />
      </ModalBody>
      <ModalFooter>
        <Button size="sm" variant="outline" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button size="sm" onClick={apply}>
          {t.pos.discount.apply}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
