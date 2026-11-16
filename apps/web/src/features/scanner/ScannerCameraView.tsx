import { AlertCircle, Zap, ZapOff } from "lucide-react";
import { t } from "../../locales/id";
import { cn } from "../../lib/cn";
import type { ScannerCamera } from "./useScannerCamera";

interface ScannerCameraViewProps {
  camera: ScannerCamera;
  onUseUpload: () => void;
  onUseManual: () => void;
}

export function ScannerCameraView({ camera, onUseUpload, onUseManual }: ScannerCameraViewProps) {
  const { error } = camera;

  if (error) {
    return (
      <div className="flex min-h-85 flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/20 text-warning">
          <AlertCircle size={26} aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-white">{t.scanner.camera.error}</p>
        <p className="mb-4 mt-1 max-w-sm text-xs leading-relaxed text-white/60">
          {error === "denied" ? t.scanner.camera.denied : t.scanner.camera.errorBody}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onUseManual}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-dark"
          >
            {t.scanner.camera.useManual}
          </button>
          <button
            type="button"
            onClick={onUseUpload}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
          >
            {t.scanner.camera.useUpload}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-85 flex-1 flex-col items-center justify-center overflow-hidden">
      <video ref={camera.videoRef} muted playsInline className="h-full min-h-85 w-full object-cover" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-52 w-72 overflow-hidden rounded-2xl border-2 border-accent/80 shadow-[0_0_0_9999px] shadow-ink/60 sm:w-80">
          <div className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-accent shadow-lg shadow-accent" />
          <div className="absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-accent" />
          <div className="absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-accent" />
          <div className="absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-accent" />
          <div className="absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-accent" />
        </div>
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-2">
        {camera.hasTorch && (
          <button
            type="button"
            onClick={camera.toggleTorch}
            aria-pressed={camera.torchOn}
            aria-label={camera.torchOn ? t.scanner.camera.torchOff : t.scanner.camera.torchOn}
            title={camera.torchOn ? t.scanner.camera.torchOff : t.scanner.camera.torchOn}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-colors",
              camera.torchOn ? "bg-warning text-ink shadow-lg shadow-warning/30" : "bg-ink/60 text-white hover:bg-ink/80",
            )}
          >
            {camera.torchOn ? <Zap size={16} aria-hidden="true" /> : <ZapOff size={16} aria-hidden="true" />}
          </button>
        )}
        {camera.devices.length > 1 && (
          <select
            aria-label={t.scanner.camera.select}
            value={camera.selectedDeviceId}
            onChange={(event) => camera.selectDevice(event.target.value)}
            className="h-9 rounded-lg border border-white/20 bg-ink/60 px-2.5 text-xs2 font-semibold text-white backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">{t.scanner.camera.auto}</option>
            {camera.devices.map((device, index) => (
              <option key={device.deviceId || index} value={device.deviceId}>
                {device.label || t.scanner.camera.numbered(index + 1)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <span className="rounded-full bg-ink/70 px-4 py-1.5 text-xs font-medium text-white/90 shadow-md backdrop-blur-md">
          {t.scanner.hint}
        </span>
      </div>
    </div>
  );
}
