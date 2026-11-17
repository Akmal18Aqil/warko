import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** A captioned group of related controls (toggle buttons, swatches) that has no single native label. */
export function FieldGroup({ label, className, children }: { label: ReactNode; className?: string; children: ReactNode }) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-1.5 text-xs2 font-semibold uppercase tracking-wider text-text-muted">{label}</legend>
      {children}
    </fieldset>
  );
}
