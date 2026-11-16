import { FlaskConical } from "lucide-react";
import { cn } from "../lib/cn";
import { t } from "../locales/id";

/** Header chip of the local demo: states it is a demo and opens the sync explanation. */
export function DemoModeBadge({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={t.app.header.demoBadgeTitle}
      className={cn(
        "flex items-center gap-1.5 rounded-xl border border-warning/50 bg-warning/15 px-3 py-2 text-xs font-bold text-warning-dark shadow-2xs transition-all hover:border-warning focus-visible:outline-2 focus-visible:outline-accent",
        className,
      )}
    >
      <FlaskConical size={14} aria-hidden="true" />
      {t.app.header.demoBadge}
    </button>
  );
}
