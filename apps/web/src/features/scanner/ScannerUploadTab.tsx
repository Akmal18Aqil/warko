import { RefreshCw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../../locales/id";

interface ScannerUploadTabProps {
  onCode: (code: string) => void;
  onFailure: () => void;
}

type UploadStatus = { kind: "scanning" } | { kind: "done"; message: string };

export function ScannerUploadTab({ onCode, onFailure }: ScannerUploadTabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus | null>(null);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const decode = async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStatus({ kind: "scanning" });
    try {
      // Lazy: the decoder is only fetched once a photo is scanned.
      const { createScanReader } = await import("./zxingReader");
      const result = await createScanReader().decodeFromImageUrl(url);
      const text = result.getText();
      setStatus({ kind: "done", message: t.scanner.upload.success(text) });
      onCode(text);
    } catch {
      setStatus({ kind: "done", message: t.scanner.upload.none });
      onFailure();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-label={t.scanner.upload.drop}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void decode(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex w-full max-w-md flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-8 transition-colors hover:border-accent/80 hover:bg-white/10"
      >
        {preview ? (
          <div className="space-y-3">
            <img
              src={preview}
              alt={t.scanner.upload.previewAlt}
              className="mx-auto max-h-48 rounded-xl border border-white/10 object-contain shadow-md"
            />
            <p className="text-xs font-semibold text-accent">{t.scanner.upload.change}</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/60 transition-colors group-hover:text-accent">
              <Upload size={28} aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-white">{t.scanner.upload.drop}</p>
            <p className="mt-1 text-xs text-white/50">{t.scanner.upload.formats}</p>
          </>
        )}
      </button>

      {status && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold"
        >
          {status.kind === "scanning" ? (
            <>
              <RefreshCw size={14} className="animate-spin text-accent" aria-hidden="true" />
              <span>{t.scanner.upload.scanning}</span>
            </>
          ) : (
            <span>{status.message}</span>
          )}
        </div>
      )}
    </div>
  );
}
