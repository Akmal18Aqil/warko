import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";

interface QtyStepperProps {
  name: string;
  qty: number;
  onDecrease: () => void;
  onIncrease: () => void;
  /** `md` on menu cards, `sm` inside the cart sheet. */
  size?: "sm" | "md";
}

/** − qty + control; both buttons are named after the product for screen readers. */
export function QtyStepper({ name, qty, onDecrease, onIncrease, size = "md" }: QtyStepperProps) {
  const compact = size === "sm";
  const button = compact ? "h-7 w-7 rounded" : "h-8 w-8 rounded-lg shadow-clay";
  return (
    <div className={cn("flex items-center gap-2 p-1", compact ? "rounded-lg bg-surface shadow-clay" : "rounded-xl bg-surface-muted")}>
      <button
        type="button"
        onClick={onDecrease}
        aria-label={t.selfOrder.menu.decrease(name)}
        className={cn("flex items-center justify-center bg-surface text-ink hover:bg-surface-muted", button)}
      >
        <Minus size={compact ? 13 : 14} aria-hidden="true" />
      </button>
      <span className={cn("text-center text-xs font-bold text-ink", compact ? "w-4" : "w-5")}>{qty}</span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={t.selfOrder.menu.increase(name)}
        className={cn("flex items-center justify-center bg-accent text-white hover:bg-accent-dark", button)}
      >
        <Plus size={compact ? 13 : 14} aria-hidden="true" />
      </button>
    </div>
  );
}
