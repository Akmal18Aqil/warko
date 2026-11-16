import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
  variant?: "pulse" | "wave";
  width?: string | number;
  height?: string | number;
  radius?: string;
}

export function Skeleton({
  className,
  children,
  variant = "pulse",
  width = "100%",
  height = "1em",
  radius = "4px",
}: SkeletonProps) {
  return (
    <span
      className={cn(
        "flex flex-col gap-2 animate-pulse rounded",
        className,
      )}
      style={{ width, height, borderRadius: radius }}
    >
      {children ?? (
        <span
          className={cn(
            "block bg-surface-muted border border-border/40",
            variant === "wave" && "bg-gradient-to-r from-surface-muted via-surface/50 to-surface-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite]",
          )}
        />
      )}
    </span>
  );
}
