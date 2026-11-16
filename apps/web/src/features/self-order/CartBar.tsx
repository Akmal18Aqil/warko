import { ShoppingBag } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";

interface CartBarProps {
  count: number;
  total: number;
  tableName: string | undefined;
  onOpen: () => void;
}

/** Floating summary that opens the cart sheet. */
export function CartBar({ count, total, tableName, onOpen }: CartBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 print:hidden">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center justify-between rounded-2xl bg-ink px-5 py-3.5 text-white shadow-xl ring-2 ring-accent/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">{count}</span>
            <div className="text-left">
              <div className="text-xs text-white/70">{tableName ?? t.selfOrder.cartBar.chooseTable}</div>
              <div className="font-display text-base font-bold">{formatIDR(total)}</div>
            </div>
          </div>
          <span className="flex items-center gap-2 text-sm font-bold">
            {t.selfOrder.cartBar.view} <ShoppingBag size={18} aria-hidden="true" />
          </span>
        </button>
      </div>
    </div>
  );
}
