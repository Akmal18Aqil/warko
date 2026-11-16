import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<string, string> = {
  sm: "h-[36px] min-h-[36px] text-xs px-3",
  md: "h-[44px] min-h-[44px] text-sm px-3.5",
  lg: "h-[48px] min-h-[48px] text-base px-4",
};

export function Input({
  label,
  error,
  disabled,
  size = "md",
  className,
  ...rest
}: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        disabled={disabled}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${rest.id}-error` : undefined}
        className={cn(
          "block w-full rounded-lg border text-text transition-colors focus:outline-none focus:ring-1 focus:ring-accent disabled:pointer-events-none disabled:opacity-50",
          disabled
            ? "bg-surface-muted border-border/40 text-text-muted cursor-not-allowed"
            : error
            ? "bg-white border-error focus:ring-error text-error"
            : "bg-surface border-border hover:border-border-hover text-text focus:border-accent/60",
          sizeClasses[size],
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={`${rest.id}-error`} className="text-[10px] font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}
