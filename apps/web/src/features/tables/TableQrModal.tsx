import { Check, Copy, ExternalLink, Printer, QrCode, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { tableOrderUrl, tableQrDataUrl } from "../../lib/tableQr";
import { t } from "../../locales/id";
import type { TableRow } from "../../types/domain";
import { Button } from "../../ui/Button";
import { Modal, ModalBody, ModalHeader } from "../../ui/Modal";

const COPIED_FEEDBACK_MS = 2500;

interface TableQrModalProps {
  table: TableRow;
  onClose: () => void;
  onPrint: (tables: TableRow[]) => void;
}

export function TableQrModal({ table, onClose, onPrint }: TableQrModalProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const url = tableOrderUrl(table);

  useEffect(() => {
    let cancelled = false;
    tableQrDataUrl(table).then(
      (dataUrl) => {
        if (!cancelled) setImageUrl(dataUrl);
      },
      () => toast.error(t.tables.qr.generateFailed),
    );
    return () => {
      cancelled = true;
    };
  }, [table]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast.success(t.tables.linkCopied);
      },
      () => toast.error(t.tables.clipboardUnavailable),
    );
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader
        title={t.tables.qr.title(table.name)}
        subtitle={table.area}
        icon={
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            <QrCode size={16} aria-hidden="true" />
          </span>
        }
      />
      <ModalBody className="text-center">
        <p className="text-xs text-text-muted">{t.tables.qr.intro}</p>

        <div className="mx-auto my-4 flex h-60 w-60 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-mineral p-3 shadow-inner">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={t.tables.qrLabel(table.name)}
              className="h-48 w-48 rounded-xl bg-surface object-contain p-1.5 shadow-xs"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center">
              <span className="animate-pulse text-xs text-text-light">{t.tables.qr.generating}</span>
            </div>
          )}
          <span className="mt-1.5 text-xs font-bold tracking-wide text-ink">
            {table.name} · {table.area}
          </span>
        </div>

        <div className="space-y-1 rounded-xl bg-surface-muted p-2.5 text-left">
          <div className="flex items-center gap-1.5 text-xs2 font-bold text-accent-dark">
            <Wifi size={13} aria-hidden="true" />
            <span>{t.tables.qr.urlLabel}</span>
          </div>
          <div className="break-all font-mono text-xs2 text-text-muted">{url}</div>
        </div>

        <div className="mt-4 space-y-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-xs font-bold text-ink shadow-sm hover:bg-accent/90"
          >
            <ExternalLink size={15} aria-hidden="true" />
            {t.tables.qr.openCustomer}
          </a>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="flex-1 gap-1.5 rounded-xl text-xs font-semibold"
            >
              {copied ? <Check size={14} className="text-success-dark" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? t.tables.qr.copied : t.tables.qr.copyLink}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPrint([table])}
              className="flex-1 gap-1.5 rounded-xl text-xs font-semibold"
            >
              <Printer size={14} aria-hidden="true" />
              {t.tables.qr.printSticker}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
