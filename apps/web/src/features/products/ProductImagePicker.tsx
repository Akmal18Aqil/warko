import { Image as ImageIcon, Link2, Search, Sparkles, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { filterGallery } from "../../data/gallery";
import { t } from "../../locales/id";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { FoodImage } from "../../ui/FoodImage";
import { type SegmentedTab, SegmentedTabs } from "../../ui/SegmentedTabs";
import { ImageGalleryTab } from "./ImageGalleryTab";
import { ImageSearchTab } from "./ImageSearchTab";
import { ImageUploadTab } from "./ImageUploadTab";
import { ImageUrlTab } from "./ImageUrlTab";
import { useImageUpload } from "./useImageUpload";

type PickerTab = "upload" | "search" | "gallery" | "url";

const TAB_ICON_SIZE = 12;

const TABS: readonly SegmentedTab<PickerTab>[] = [
  { id: "upload", icon: <Upload size={TAB_ICON_SIZE} aria-hidden="true" />, label: t.products.picker.tabs.upload },
  { id: "search", icon: <Search size={TAB_ICON_SIZE} aria-hidden="true" />, label: t.products.picker.tabs.search },
  { id: "gallery", icon: <Sparkles size={TAB_ICON_SIZE} aria-hidden="true" />, label: t.products.picker.tabs.gallery },
  { id: "url", icon: <Link2 size={TAB_ICON_SIZE} aria-hidden="true" />, label: t.products.picker.tabs.url },
];

interface ProductImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  productName?: string;
}

/** Product photo chooser: current-photo preview plus upload / search / gallery / link tabs. */
export function ProductImagePicker({ value, onChange, productName = "" }: ProductImagePickerProps) {
  const [tab, setTab] = useState<PickerTab>("upload");
  const [searchQuery, setSearchQuery] = useState(productName);
  const upload = useImageUpload(onChange);
  const searchResults = useMemo(() => filterGallery(searchQuery, null), [searchQuery]);

  const text = t.products.picker;
  const isLocalImage = value.startsWith("data:image");

  const openSearch = () => {
    if (!searchQuery && productName) setSearchQuery(productName);
    setTab("search");
  };

  const statusText = isLocalImage ? text.statusLocal : value ? text.statusWeb : text.statusNone;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-mineral/20 p-3.5">
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {value ? (
            <FoodImage key={value} item={{ name: productName || text.previewAlt, image: value }} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-mineral text-ink/30">
              <ImageIcon size={24} aria-hidden="true" />
            </div>
          )}
          {isLocalImage && (
            <Badge tone="accent" solid className="absolute bottom-1 right-1 rounded px-1 py-0 text-2xs font-bold">
              {text.localBadge}
            </Badge>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/70">{text.selectedTitle}</p>
          <p className="mt-0.5 truncate text-xs2 font-medium text-text-muted">{statusText}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={upload.openDialog}>
              <Upload size={11} aria-hidden="true" />
              {text.changePhoto}
            </Button>
            <Button variant="secondary" size="sm" onClick={openSearch}>
              <Search size={11} aria-hidden="true" />
              {text.searchOnline}
            </Button>
          </div>
        </div>
      </div>

      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} label={text.tabsLabel} />

      <input
        ref={upload.inputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        aria-label={text.fileInputLabel}
        tabIndex={-1}
        onChange={upload.onInputChange}
        className="hidden"
      />

      <div role="tabpanel">
        {tab === "upload" && (
          <ImageUploadTab
            processing={upload.processing}
            onOpenDialog={upload.openDialog}
            onFile={(file) => void upload.processFile(file)}
          />
        )}
        {tab === "search" && (
          <ImageSearchTab
            query={searchQuery}
            onQueryChange={setSearchQuery}
            productName={productName}
            results={searchResults}
            value={value}
            onSelect={onChange}
          />
        )}
        {tab === "gallery" && <ImageGalleryTab value={value} onSelect={onChange} />}
        {tab === "url" && <ImageUrlTab key={value} value={value} onApply={onChange} />}
      </div>
    </div>
  );
}
