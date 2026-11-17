import { STORAGE_KEYS } from "../../lib/storageKeys";

/** Thermal roll widths the receipt layouts support. */
export const PAPER_WIDTHS = [58, 80] as const;
export type PaperWidth = (typeof PAPER_WIDTHS)[number];

/** Printable width of each roll: the print head leaves a few millimetres blank on both edges. */
export const PRINTABLE_MM: Record<PaperWidth, number> = { 58: 48, 80: 72 };

/** Characters per line in the printer's standard font (Font A, 12×24 dots). */
export const LINE_CHARS: Record<PaperWidth, number> = { 58: 32, 80: 48 };

export function getPaperWidth(): PaperWidth {
  return localStorage.getItem(STORAGE_KEYS.printerPaper) === "80" ? 80 : 58;
}

export function setPaperWidth(width: PaperWidth): void {
  localStorage.setItem(STORAGE_KEYS.printerPaper, String(width));
}
