import { type ReactNode, useId } from "react";
import { cn } from "../../lib/cn";

/** A captioned group of related controls (radio buttons, swatches) that has no single native label. */
export function FieldGroup({
  label,
  role = "group",
  className,
  children,
}: {
  label: ReactNode;
  role?: "group" | "radiogroup";
  className?: string;
  children: ReactNode;
}) {
  const captionId = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <p id={captionId} className="text-xs2 font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <div role={role} aria-labelledby={captionId}>
        {children}
      </div>
    </div>
  );
}
