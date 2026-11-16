import type { ReactNode } from "react";
import { LinkRow } from "./LinkRow";
import { QrCard } from "./QrCard";
import type { QrState } from "./useQrDataUrl";

interface AccessLinkTabProps {
  qr: QrState;
  qrAlt: string;
  qrTitle: string;
  qrBody: string;
  linkTitle: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
  note: AccessNote;
}

/** Tinted instruction card shown under the link. */
interface AccessNote {
  tone: "success" | "warning";
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

const NOTE_TONE: Record<AccessNote["tone"], string> = {
  success: "border-success/30 bg-success/10 text-success-dark",
  warning: "border-warning/40 bg-warning/10 text-warning-dark",
};

/** Shared body of the waiter and kitchen tabs: a QR, the direct link, and an instruction card. */
export function AccessLinkTab({ qr, qrAlt, qrTitle, qrBody, linkTitle, url, copied, onCopy, note }: AccessLinkTabProps) {
  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
      <QrCard qr={qr} alt={qrAlt} title={qrTitle} body={qrBody} />
      <div className="space-y-4">
        <div className="space-y-2.5 rounded-xl border border-border bg-surface p-4 shadow-clay">
          <span className="block text-xs font-bold uppercase tracking-wider text-text-muted">{linkTitle}</span>
          <LinkRow url={url} copied={copied} onCopy={onCopy} openable />
        </div>
        <div className={`space-y-2 rounded-xl border p-4 text-xs ${NOTE_TONE[note.tone]}`}>
          <p className="flex items-center gap-1.5 font-bold">
            {note.icon} {note.title}
          </p>
          {note.children}
        </div>
      </div>
    </div>
  );
}
