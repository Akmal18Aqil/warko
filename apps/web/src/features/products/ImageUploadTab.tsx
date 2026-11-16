import { Camera, FolderOpen } from "lucide-react";
import { type DragEvent, useState } from "react";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";

/** Click-or-drop area that hands an image file to the picker's upload pipeline. */
export function ImageUploadTab({
  processing,
  onOpenDialog,
  onFile,
}: {
  processing: boolean;
  onOpenDialog: () => void;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const text = t.products.picker.upload;

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <button
      type="button"
      disabled={processing}
      onClick={onOpenDialog}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait",
        dragging ? "scale-[1.01] border-accent bg-accent/20" : "border-border bg-surface hover:border-border-hover hover:bg-mineral/20",
      )}
    >
      <span className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-mineral text-ink/70">
        <FolderOpen size={18} aria-hidden="true" />
      </span>
      <span className="font-display text-xs font-bold text-ink">{processing ? text.processing : text.prompt}</span>
      <span className="mt-0.5 text-2xs text-text-muted">{text.hint}</span>
      <span className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-xs2 font-bold text-mineral shadow-sm">
        <Camera size={12} aria-hidden="true" />
        {text.openFile}
      </span>
    </button>
  );
}
