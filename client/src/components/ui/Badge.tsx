import { cn } from "../../lib/cn";

export type BadgeTone =
  | "neutral"
  | "lime"
  | "success"
  | "warning"
  | "error"
  | "coral"
  | "dark";

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children?: React.ReactNode;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface text-text-muted border border-border/50",
  lime: "bg-accent text-white",
  success: "bg-success text-ink",
  warning: "bg-warning text-ink",
  error: "bg-error text-white",
  coral: "bg-coral text-white",
  dark: "bg-ink text-mineral",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: BadgeProps) {
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
