import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SettingsCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  note?: string;
  /** Control placed at the top-right corner of the card. */
  action?: ReactNode;
  wide?: boolean;
  children?: ReactNode;
}

/** Shared shell of the settings screen: icon, caption, current value, optional note, controls. */
export function SettingsCard({ icon, label, value, note, action, wide, children }: SettingsCardProps) {
  return (
    <article
      className={cn(
        "rounded-xl border border-ink/10 bg-surface p-5 shadow-clay transition hover:border-border-hover",
        wide && "md:col-span-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white">{icon}</span>
        {action}
      </div>
      <h2 className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink/50">{label}</h2>
      <p className="mt-0.5 font-display text-base font-bold text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-ink/50">{note}</p>}
      {children && <div className="mt-4 border-t border-ink/10 pt-3">{children}</div>}
    </article>
  );
}
