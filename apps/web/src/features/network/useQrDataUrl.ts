import { useEffect, useState } from "react";
import { qrDataUrl } from "../../lib/qr";

/** Shared by every QR in the network hub. The dark colour is the theme `ink` token (the QR library needs a literal value). */
const QR_OPTIONS = { width: 280, margin: 1, color: { dark: "#172B4D", light: "#FFFFFF" } } as const;

export type QrState = { status: "loading" } | { status: "ready"; dataUrl: string } | { status: "failed" };

/** Renders `text` as a QR data URL; re-renders when the text changes. A null text yields `loading`. */
export function useQrDataUrl(text: string | null): QrState {
  const [result, setResult] = useState<{ text: string; state: QrState } | null>(null);

  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    qrDataUrl(text, QR_OPTIONS)
      .then((dataUrl) => !cancelled && setResult({ text, state: { status: "ready", dataUrl } }))
      .catch((error: unknown) => {
        console.error("QR code gagal dibuat:", error);
        if (!cancelled) setResult({ text, state: { status: "failed" } });
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  return result && result.text === text ? result.state : { status: "loading" };
}
