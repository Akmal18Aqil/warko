import { Coffee, Cookie, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { MenuKind } from "../../data/menu";
import { cn } from "../../lib/cn";
import { FieldGroup } from "./FieldGroup";

/** Kitchen routes a category/product can belong to. */
const PRODUCT_KINDS = ["Makanan", "Minuman", "Camilan"] as const satisfies readonly MenuKind[];

export const DEFAULT_PRODUCT_KIND: MenuKind = "Makanan";

const KIND_ICON: Record<MenuKind, LucideIcon> = {
  Makanan: UtensilsCrossed,
  Minuman: Coffee,
  Camilan: Cookie,
};

export function KindIcon({ kind, size = 12 }: { kind: MenuKind; size?: number }) {
  const Icon = KIND_ICON[kind];
  return <Icon size={size} aria-hidden="true" />;
}

export function KindPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MenuKind;
  onChange: (kind: MenuKind) => void;
}) {
  return (
    <FieldGroup label={label} role="radiogroup">
      <div className="grid grid-cols-3 gap-1.5">
        {PRODUCT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={value === kind}
            onClick={() => onChange(kind)}
            className={cn(
              "flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              value === kind
                ? "border-ink bg-ink text-mineral shadow-sm"
                : "border-border bg-surface text-text-muted hover:text-ink",
            )}
          >
            <KindIcon kind={kind} />
            {kind}
          </button>
        ))}
      </div>
    </FieldGroup>
  );
}
