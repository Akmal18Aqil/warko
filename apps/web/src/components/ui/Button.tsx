import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant =
  | "primary"
  | "secondary"
  | "ink"
  | "outline"
  | "ghost"
  | "danger"
  | "danger-ghost"
  | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-white border-accent hover:bg-accent-dark hover:border-accent-dark shadow-sm disabled:bg-accent/60 disabled:border-accent/60 disabled:text-white/70",
  secondary:
    "bg-surface text-ink border-border hover:bg-surface-muted hover:border-border-hover shadow-sm disabled:bg-surface/40 disabled:text-ink/40 disabled:border-border/40",
  ink:
    "bg-ink text-mineral hover:bg-ink-soft shadow-sm disabled:bg-ink/40 disabled:text-mineral/40",
  outline:
    "border border-border bg-surface text-ink hover:border-accent hover:bg-accent/5 disabled:border-border/40 disabled:bg-surface/30 disabled:text-ink/40",
  ghost:
    "text-ink/70 hover:bg-ink/5 hover:text-ink disabled:text-ink/20 disabled:bg-transparent disabled:opacity-60",
  danger:
    "bg-error text-white border-error hover:bg-error-dark hover:border-error-dark disabled:bg-error/60 disabled:border-error/60 disabled:text-white/70",
  "danger-ghost":
    "text-error hover:bg-error/10 hover:text-error-dark disabled:text-error/30 disabled:bg-transparent disabled:opacity-60",
  success:
    "bg-success text-ink border-success hover:bg-success-dark hover:border-success-dark hover:text-white disabled:bg-success/60 disabled:border-success/60 disabled:text-ink/60",
};

const sizeClasses: Record<Size, string> = {
  sm: `h-[36px] min-h-[36px] px-3 text-xs gap-1.5`,
  md: `h-[44px] min-h-[44px] px-4 text-sm gap-2`,
  lg: `h-[48px] min-h-[48px] px-5 text-base gap-2`,
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  loading = false,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "clay-control pressable inline-flex items-center justify-center rounded-lg font-medium transition-all duration-140 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children?: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "clay-control pressable inline-flex h-[40px] min-h-[40px] w-[40px] min-w-[40px] items-center justify-center rounded-lg text-ink/70 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
