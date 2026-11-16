import { Printer } from "lucide-react";
import { useMemo } from "react";
import { cn } from "../../lib/cn";
import { STORE_PROFILE } from "../../lib/storeProfile";
import { t } from "../../locales/id";
import { type ReportRow, usePrint } from "../../state/print";
import type { ShiftRecord } from "../../types/domain";
import { Button } from "../../ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { formatDateTime } from "./format";
import { buildZReportPayload } from "./zReport";

interface ZReportPreviewProps {
  shift: ShiftRecord;
  onClose: () => void;
}

function Rows({ rows }: { rows: readonly ReportRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.label} className={cn("flex justify-between gap-3", row.strong && "font-bold")}>
          <span>{row.label}</span>
          <span className="text-right">{row.value}</span>
        </div>
      ))}
    </>
  );
}

const SEPARATOR = <div aria-hidden="true" className="my-2 border-b border-dashed border-ink/20" />;

/** On-screen copy of the shift report; "print" sends the very same payload to the print layer. */
export function ZReportPreview({ shift, onClose }: ZReportPreviewProps) {
  const text = t.cashDrawer.zReport;
  const { printZReport } = usePrint();
  const report = useMemo(() => buildZReportPayload(shift), [shift]);
  const printedAt = useMemo(() => formatDateTime(Date.now()), []);

  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader title={text.title} icon={<Printer size={20} className="shrink-0 text-accent-dark" aria-hidden="true" />} />
      <ModalBody>
        <div className="select-text space-y-2 rounded-xl border border-ink/15 bg-mineral/40 p-4 font-mono text-xs text-ink shadow-inner">
          <div className="text-center text-sm font-bold tracking-wide">{STORE_PROFILE.brand.toUpperCase()}</div>
          <div className="text-center text-xs2 text-text-muted">{STORE_PROFILE.outlet.toUpperCase()}</div>
          <div className="text-center text-xs2 text-text-muted">{text.subtitle.toUpperCase()}</div>
          {SEPARATOR}
          <Rows rows={report.details} />
          {SEPARATOR}
          <Rows rows={report.figures} />
          {report.denominations.length > 0 ? (
            <>
              {SEPARATOR}
              <div className="font-bold">{t.printing.zReport.denominations}</div>
              <Rows rows={report.denominations} />
            </>
          ) : null}
          {report.notes ? (
            <>
              {SEPARATOR}
              <div className="text-xs2 text-text-muted">
                {text.notes}: {report.notes}
              </div>
            </>
          ) : null}
          {SEPARATOR}
          <div className="pt-1 text-center text-2xs text-text-light">{text.printedAt(printedAt)}</div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t.common.close}
        </Button>
        <Button variant="ink" size="sm" onClick={() => printZReport(report)} className="gap-2 font-semibold">
          <Printer size={15} aria-hidden="true" />
          {text.print}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
