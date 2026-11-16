import { BrowserMultiFormatReader, type IBrowserCodeReaderOptions } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/** Formats both the live camera and the photo decoder look for. */
const SCAN_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
];

const SCAN_HINTS: ReadonlyMap<DecodeHintType, unknown> = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, SCAN_FORMATS],
]);

/**
 * The one ZXing reader configuration. Import this module lazily (`await import("./zxingReader")`)
 * so the decoder only loads when the scanner is actually used.
 */
export function createScanReader(options?: IBrowserCodeReaderOptions): BrowserMultiFormatReader {
  return new BrowserMultiFormatReader(new Map(SCAN_HINTS), options);
}
