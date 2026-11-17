import { useMemo, useState } from "react";
import { filterGallery, GALLERY_CATEGORIES, type GalleryCategory } from "../../data/gallery";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { GalleryGrid } from "./GalleryGrid";

/** Curated culinary photos, filterable by menu category. */
export function ImageGalleryTab({ value, onSelect }: { value: string; onSelect: (url: string) => void }) {
  const [category, setCategory] = useState<GalleryCategory | null>(null);
  const images = useMemo(() => filterGallery("", category), [category]);

  const chipClass = (active: boolean) =>
    cn(
      "rounded-full border px-2 py-0.5 text-2xs font-semibold transition-colors",
      active ? "border-ink bg-ink text-mineral" : "border-border bg-surface text-ink/65 hover:border-border-hover hover:text-ink",
    );

  return (
    <div className="space-y-2">
      <fieldset className="flex min-w-0 flex-wrap gap-1">
        <legend className="sr-only">{t.products.picker.gallery.filterLabel}</legend>
        <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={chipClass(category === null)}>
          {t.products.picker.gallery.all}
        </button>
        {GALLERY_CATEGORIES.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
            className={chipClass(category === name)}
          >
            {name}
          </button>
        ))}
      </fieldset>
      <GalleryGrid images={images} value={value} onSelect={onSelect} className="max-h-44 sm:grid-cols-4" />
    </div>
  );
}
