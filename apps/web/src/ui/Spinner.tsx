import { cn } from "../lib/cn";
import { t } from "../locales/id";

function Spinner({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="inline-block shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
    />
  );
}

/** Inline "loading" indicator with a visible label. */
export function LoadingText({ label = t.common.loading, className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center gap-2 text-xs text-text-muted", className)}>
      <Spinner size={14} />
      <span>{label}</span>
    </div>
  );
}
