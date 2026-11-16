import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "../../locales/id";

const COPIED_FLASH_MS = 2500;

/** Copies a link to the clipboard, reports the outcome, and remembers which link was copied last for a short while. */
export function useCopyLink() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const copy = useCallback(async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error("Gagal menyalin ke clipboard:", error);
      toast.error(t.network.hub.copyFailed);
      return;
    }
    setCopiedUrl(url);
    toast.success(t.network.hub.copied(label));
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopiedUrl(null), COPIED_FLASH_MS);
  }, []);

  return { copiedUrl, copy };
}
