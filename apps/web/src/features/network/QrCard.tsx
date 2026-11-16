import { t } from "../../locales/id";
import type { QrState } from "./useQrDataUrl";

interface QrCardProps {
  qr: QrState;
  alt: string;
  title: string;
  body: string;
}

/** QR image with a caption; shows a skeleton while rendering and a message if rendering failed. */
export function QrCard({ qr, alt, title, body }: QrCardProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-4 text-center shadow-clay">
      {qr.status === "ready" ? (
        <img src={qr.dataUrl} alt={alt} className="h-52 w-52 rounded-xl border border-border bg-surface p-2" />
      ) : qr.status === "failed" ? (
        <div role="alert" className="flex h-52 w-52 items-center justify-center rounded-xl bg-mineral text-xs text-text-muted">
          {t.network.hub.qrFailed}
        </div>
      ) : (
        <div className="h-52 w-52 animate-pulse rounded-xl bg-mineral" />
      )}
      <p className="mt-3 text-xs font-bold text-ink">{title}</p>
      <p className="mt-0.5 text-xs2 text-text-muted">{body}</p>
    </div>
  );
}
