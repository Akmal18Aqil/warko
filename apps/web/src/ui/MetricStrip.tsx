import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type MetricTone = "neutral" | "success" | "warning" | "error" | "accent";

const TONE_TEXT: Record<MetricTone, string> = {
  neutral: "text-ink",
  accent: "text-accent-dark",
  success: "text-success-dark",
  warning: "text-warning-dark",
  error: "text-error-dark",
};

const TONE_ICON: Record<MetricTone, string> = {
  neutral: "border-border bg-mineral text-ink-soft",
  accent: "border-accent/20 bg-accent/10 text-accent-dark",
  success: "border-success/30 bg-success/15 text-success-dark",
  warning: "border-warning/40 bg-warning/15 text-warning-dark",
  error: "border-error/30 bg-error/10 text-error-dark",
};

/** A row of dividing metric cells (`MetricCell`) in one rounded card. */
export function MetricStrip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid grid-cols-2 divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-2xs lg:grid-cols-4 lg:divide-x",
        className,
      )}
    >
      {children}
    </section>
  );
}

interface MetricCellProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: MetricTone;
  footnote?: ReactNode;
  /** Accent bar on the leading edge. */
  active?: boolean;
}

export function MetricCell({ label, value, icon, tone = "neutral", footnote, active = false }: MetricCellProps) {
  return (
    <div className="relative flex min-w-0 items-center gap-3 px-4 py-3.5 md:px-5">
      {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" /> : null}
      {icon ? (
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", TONE_ICON[tone])}>{icon}</span>
      ) : null}
      <div className="min-w-0">
        <p className="label-caps text-2xs font-semibold text-ink/50">{label}</p>
        <p className={cn("mt-0.5 truncate font-display text-base font-bold tracking-tight md:text-lg", TONE_TEXT[tone])}>{value}</p>
        {footnote ? <p className="truncate text-2xs text-text-muted">{footnote}</p> : null}
      </div>
    </div>
  );
}
