import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "error" | "dark";

interface BadgeProps {
  tone?: BadgeTone;
  /** Filled variant for emphasis (counts, "new" markers); the default is the soft tinted pill. */
  solid?: boolean;
  className?: string;
  children?: ReactNode;
}

const SOFT: Record<BadgeTone, string> = {
  neutral: "border-border/50 bg-surface text-text-muted",
  accent: "border-accent/20 bg-accent/10 text-accent-dark",
  success: "border-success/30 bg-success/15 text-success-dark",
  warning: "border-warning/40 bg-warning/15 text-warning-dark",
  error: "border-error/30 bg-error/10 text-error-dark",
  dark: "border-ink bg-ink text-mineral",
};

const SOLID: Record<BadgeTone, string> = {
  neutral: "border-ink/10 bg-ink/10 text-ink",
  accent: "border-accent bg-accent text-white",
  success: "border-success-dark bg-success-dark text-white",
  warning: "border-warning bg-warning text-ink",
  error: "border-error-dark bg-error-dark text-white",
  dark: "border-ink bg-ink text-mineral",
};

export function Badge({ tone = "neutral", solid = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs2 font-semibold",
        solid ? SOLID[tone] : SOFT[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
