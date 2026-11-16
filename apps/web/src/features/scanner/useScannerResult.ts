import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { dataSource } from "../../data/index";
import type { MenuItem } from "../../data/menu";
import { playScanErrorBeep, playScanSuccessBeep } from "../../lib/audioFeedback";
import { parseTableQr, resolveTable } from "../../lib/tableQr";
import { t } from "../../locales/id";
import { useTables } from "../../state/catalog";

/** Delay before the scanner closes so the success toast and beep are noticed. */
const CLOSE_DELAY_MS = 700;
/** Pause after an unrecognised code so a steady camera does not fire the warning repeatedly. */
const RETRY_COOLDOWN_MS = 1500;

interface ScannerResultCallbacks {
  onClose: () => void;
  onProduct?: (item: MenuItem) => void;
  onScanCode?: (code: string) => void;
}

/**
 * Turns decoded or typed text into an outcome: a table QR, a known product barcode, or an
 * unrecognised code. A code is ignored while a previous one is still being handled.
 */
export function useScannerResult({ onClose, onProduct, onScanCode }: ScannerResultCallbacks) {
  const tables = useTables();
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const handlingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const latest = useRef({ tables, onClose, onProduct, onScanCode });
  latest.current = { tables, onClose, onProduct, onScanCode };

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const closeSoon = useCallback(() => {
    timerRef.current = window.setTimeout(() => latest.current.onClose(), CLOSE_DELAY_MS);
  }, []);

  const handleCode = useCallback(
    async (rawText: string) => {
      const code = rawText.trim();
      if (!code || handlingRef.current) return;
      handlingRef.current = true;
      setLastScannedCode(code);

      const tableKey = parseTableQr(code);
      if (tableKey) {
        const table = resolveTable(latest.current.tables, tableKey);
        playScanSuccessBeep();
        toast.success(t.scanner.tableDetected, { description: t.scanner.tableCode(table?.name ?? tableKey) });
        latest.current.onScanCode?.(code);
        closeSoon();
        return;
      }

      try {
        const product = await dataSource.findProductByBarcode(code);
        if (product) {
          playScanSuccessBeep();
          toast.success(t.scanner.added(product.name), {
            description: t.scanner.addedBody(product.barcode, product.category),
          });
          latest.current.onProduct?.(product);
          latest.current.onScanCode?.(code);
          closeSoon();
          return;
        }
      } catch (error) {
        console.error("Pencarian produk berdasarkan barcode gagal:", error);
        playScanErrorBeep();
        toast.error(t.scanner.lookupFailed);
        timerRef.current = window.setTimeout(() => (handlingRef.current = false), RETRY_COOLDOWN_MS);
        return;
      }

      playScanErrorBeep();
      latest.current.onScanCode?.(code);
      toast.warning(t.scanner.notFound(code), { description: t.scanner.notFoundBody });
      timerRef.current = window.setTimeout(() => (handlingRef.current = false), RETRY_COOLDOWN_MS);
    },
    [closeSoon],
  );

  return { lastScannedCode, handleCode };
}
