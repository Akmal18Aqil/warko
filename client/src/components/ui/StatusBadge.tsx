import { cn } from "../../lib/cn";

export type StatusTone = "neutral" | "success" | "warning" | "error" | "ink";

interface StatusBadgeProps {
  tone?: StatusTone;
  className?: string;
  children?: React.ReactNode;
}

const tones: Record<StatusTone, string> = {
  neutral: "bg-surface text-text-muted border border-border/50",
  success: "bg-success/10 text-success-dark border border-success/20",
  warning: "bg-warning/10 text-warning-dark border border-warning/20",
  error: "bg-error/10 text-error-dark border border-error/20",
  ink: "bg-ink text-mineral",
} as const;

export function StatusBadge({
  tone = "neutral",
  className,
  children,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
