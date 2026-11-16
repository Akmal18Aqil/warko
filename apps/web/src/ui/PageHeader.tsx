import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  titleClassName,
  subtitleClassName,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-4 flex flex-col gap-1", className)}>
      {title && (
        <h2 className={cn("font-display text-lg font-bold tracking-tight text-ink", titleClassName)}>
          {title}
        </h2>
      )}
      {subtitle && (
        <p className={cn("text-[11px] text-text-muted", subtitleClassName)}>
          {subtitle}
        </p>
      )}
      {children && <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}
