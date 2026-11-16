import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface EmptyProps {
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function Empty({
  icon,
  title,
  subtitle,
  action,
  className,
}: EmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-1 min-h-0 flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      {icon && (
        <div className="w-16 h-16 shrink-0 rounded-2xl bg-surface-muted border border-border flex items-center justify-center text-text-muted shadow-sm">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="font-display text-base font-bold text-text">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-[11px] text-text-muted max-w-xs leading-relaxed">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
