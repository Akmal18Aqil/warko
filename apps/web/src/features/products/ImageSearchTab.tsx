import { ExternalLink, RefreshCw, Search } from "lucide-react";
import type { GalleryImage } from "../../data/gallery";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { GalleryGrid } from "./GalleryGrid";

const FALLBACK_SEARCH_TERM = "menu kuliner makanan minuman";
const SEARCH_SUFFIX = "food culinary hd";

/** Searches the built-in gallery and hands off to Google Images for anything else. */
export function ImageSearchTab({
  query,
  onQueryChange,
  productName,
  results,
  value,
  onSelect,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  productName: string;
  results: readonly GalleryImage[];
  value: string;
  onSelect: (url: string) => void;
}) {
  const text = t.products.picker.search;
  const term = query.trim() || productName.trim() || FALLBACK_SEARCH_TERM;
  const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${term} ${SEARCH_SUFFIX}`)}`;

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-1.5">
        <div className="relative flex-1">
          <Search size={13} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
          <Input
            type="search"
            size="sm"
            aria-label={text.inputLabel}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              // The picker lives inside the product form: Enter must not submit it.
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder={text.placeholder}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!productName}
          onClick={() => onQueryChange(productName)}
          title={text.useProductNameHint}
          className="shrink-0 font-bold"
        >
          <RefreshCw size={11} aria-hidden="true" />
          {text.useProductName}
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-accent-dark/30 bg-accent/20 p-2.5">
        <div className="min-w-0 pr-2">
          <p className="text-xs font-bold text-ink">{text.googleTitle}</p>
          <p className="mt-0.5 text-2xs leading-tight text-ink/65">{text.googleHelp}</p>
        </div>
        <a
          href={googleImagesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pressable inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-accent-dark"
        >
          {text.openGoogle}
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>

      <div>
        <p className="mb-1 text-2xs font-bold uppercase tracking-wider text-text-muted">{text.resultsTitle(results.length)}</p>
        {results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-center">
            <p className="text-xs font-semibold text-ink/70">{text.noResults(query)}</p>
            <p className="mt-0.5 text-2xs text-text-muted">{text.noResultsHint}</p>
          </div>
        ) : (
          <GalleryGrid images={results} value={value} onSelect={onSelect} className="max-h-40" />
        )}
      </div>
    </div>
  );
}
