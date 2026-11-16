import { Check } from "lucide-react";
import type { GalleryImage } from "../../data/gallery";
import { cn } from "../../lib/cn";

/** Thumbnail grid of gallery photos; the photo equal to `value` is marked as selected. */
export function GalleryGrid({
  images,
  value,
  onSelect,
  className,
}: {
  images: readonly GalleryImage[];
  value: string;
  onSelect: (url: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-1.5 overflow-y-auto pr-1", className)}>
      {images.map((image) => {
        const selected = value === image.url;
        return (
          <button
            key={image.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(image.url)}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-lg border text-left transition-all",
              selected ? "border-accent-dark ring-2 ring-accent" : "border-border bg-surface hover:border-border-hover",
            )}
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink/5">
              <img
                src={image.url}
                alt={image.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {selected && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white shadow-sm">
                  <Check size={10} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </div>
            <p className="truncate p-1 text-2xs font-semibold leading-tight text-ink">{image.title}</p>
          </button>
        );
      })}
    </div>
  );
}
