import { useState } from "react";
import { Barcode as BarcodeIcon, Camera, Keyboard, Upload, X } from "lucide-react";
import type { MenuItem } from "../../data/menu";
import { playScanErrorBeep } from "../../lib/audioFeedback";
import { t } from "../../locales/id";
import { Modal } from "../../ui/Modal";
import { SegmentedTabs, type SegmentedTab } from "../../ui/SegmentedTabs";
import { ScannerCameraView } from "./ScannerCameraView";
import { ScannerManualEntry } from "./ScannerManualEntry";
import { ScannerUploadTab } from "./ScannerUploadTab";
import { useScannerCamera } from "./useScannerCamera";
import { useScannerResult } from "./useScannerResult";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onProduct?: (item: MenuItem) => void;
  onScanCode?: (code: string) => void;
  title?: string;
  subtitle?: string;
}

type ScannerTab = "camera" | "upload" | "manual";

const TABS: readonly SegmentedTab<ScannerTab>[] = [
  { id: "camera", label: t.scanner.tabs.camera, icon: <Camera size={14} aria-hidden="true" /> },
  { id: "upload", label: t.scanner.tabs.upload, icon: <Upload size={14} aria-hidden="true" /> },
  { id: "manual", label: t.scanner.tabs.manual, icon: <Keyboard size={14} aria-hidden="true" /> },
];

export function BarcodeScanner({ open, title = t.scanner.title, ...rest }: BarcodeScannerProps) {
  return (
    <Modal
      open={open}
      onClose={rest.onClose}
      ariaLabel={title}
      className="border-white/10! bg-ink! text-white"
    >
      <ScannerDialog title={title} {...rest} />
    </Modal>
  );
}

/** Mounted only while the modal is open, so tab, camera and result state reset on every open. */
function ScannerDialog({
  title,
  subtitle = t.scanner.subtitle,
  onClose,
  onProduct,
  onScanCode,
}: Omit<BarcodeScannerProps, "open"> & { title: string }) {
  const [tab, setTab] = useState<ScannerTab>("camera");
  const { lastScannedCode, handleCode } = useScannerResult({ onClose, onProduct, onScanCode });
  const camera = useScannerCamera(tab === "camera", (text) => void handleCode(text));

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent">
            <BarcodeIcon size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold tracking-tight text-white">{title}</h2>
            <p className="text-xs text-white/60">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label={t.scanner.close}
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <SegmentedTabs
        tone="dark"
        label={t.scanner.tabsLabel}
        tabs={TABS}
        value={tab}
        onChange={setTab}
        className="m-1.5 shrink-0"
      />

      <div className="relative flex min-h-75 flex-1 flex-col justify-center overflow-y-auto bg-ink/40">
        {tab === "camera" && (
          <ScannerCameraView camera={camera} onUseUpload={() => setTab("upload")} onUseManual={() => setTab("manual")} />
        )}
        {tab === "upload" && <ScannerUploadTab onCode={(code) => void handleCode(code)} onFailure={playScanErrorBeep} />}
        {tab === "manual" && <ScannerManualEntry onSubmit={(code) => void handleCode(code)} />}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-xs text-white/60">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
          <span>{t.scanner.footerNote}</span>
        </div>
        {lastScannedCode && (
          <span className="max-w-48 truncate font-mono text-xs2 text-accent">
            {t.scanner.lastScanned(lastScannedCode)}
          </span>
        )}
      </div>
    </>
  );
}
