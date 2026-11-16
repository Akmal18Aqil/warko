import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SegmentedTab<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** `dark` for tab strips on a dark panel (camera scanner). */
  tone?: "light" | "dark";
  className?: string;
}

/** Pill-style tab strip shared by the cash drawer, waiter, scanner, network and image-picker screens. */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  tone = "light",
  className,
}: SegmentedTabsProps<T>) {
  const dark = tone === "dark";
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex gap-1 rounded-xl p-1 text-xs font-semibold",
        dark ? "bg-ink/60" : "border border-border bg-surface-muted",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active
                ? dark
                  ? "bg-white/15 text-white"
                  : "bg-surface text-accent-dark shadow-sm"
                : dark
                  ? "text-white/60 hover:text-white"
                  : "text-text-muted hover:text-ink",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
