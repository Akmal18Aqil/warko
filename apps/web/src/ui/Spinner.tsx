import type { SVGProps } from "react";
import { cn } from "../../lib/cn";

interface SpinnerProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function Spinner({ size = 24, className, ...rest }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("animate-spin", className)}
      {...rest}
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-accent"
      />
      <path
        d="M12 16V6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-accent/30"
      />
      <path
        d="M12 8H4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-accent/30"
      />
    </svg>
  );
}

export function LoadingText({
  label = "Memuat…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-text-muted", className)}>
      <Spinner size={14} />
      <span>{label}</span>
    </div>
  );
}
