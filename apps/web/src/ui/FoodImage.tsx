import { useState } from "react";
import type { MenuItem } from "../data/menu";
import { cn } from "../lib/cn";

export function FoodImage({ item, className }: { item: Pick<MenuItem, "name" | "image">; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!item.image || failedSrc === item.image) {
    return (
      <div
        role="img"
        aria-label={item.name}
        className={cn("flex items-center justify-center bg-gradient-to-br from-surface-muted to-border", className)}
      >
        <span className="font-display text-sm font-bold tracking-wide text-ink/60">
          {item.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 3)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={item.image}
      alt={item.name}
      loading="lazy"
      onError={() => setFailedSrc(item.image)}
      className={cn("object-cover", className)}
    />
  );
}
