import type { QRCodeToDataURLOptions } from "qrcode";

/** Encodes `text` as a PNG data URL. */
export async function qrDataUrl(text: string, options: QRCodeToDataURLOptions): Promise<string> {
  // Code-split: the QR encoder is only needed on screens that render a QR code.
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(text, options);
}
