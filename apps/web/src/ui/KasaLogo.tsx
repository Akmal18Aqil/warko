import { cn } from "../lib/cn";

export function KasaMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Logo WAKRO Digital"
    >
      <rect width="32" height="32" rx="7" fill="#2D6CDF" />
      <path
        d="M7.5 12.25a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v2.25H7.5v-2.25Z"
        fill="#FFFFFF"
      />
      <rect x="7.5" y="14.5" width="17" height="10" rx="2" fill="#FFFFFF" />
      <rect x="10.5" y="12.5" width="5.5" height="1.5" rx="0.75" fill="#172B4D" />
      <circle cx="20.5" cy="13.25" r="1.1" fill="#2D6CDF" />
      <rect x="11" y="17.5" width="10" height="2" rx="1" fill="#172B4D" />
      <rect x="11" y="21" width="6" height="1.5" rx="0.75" fill="#2D6CDF" />
    </svg>
  );
}

export function KasaLogoBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <KasaMark size={compact ? 30 : 38} />
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-lg font-bold tracking-tight text-ink">
            WAKRO
          </p>
          <p className="label-caps text-xs2 font-semibold text-ink/55">
            DIGITAL POS
          </p>
        </div>
      )}
    </div>
  );
}

export function StatusDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2 w-2 rounded-full bg-success", className)}
    />
  );
}
