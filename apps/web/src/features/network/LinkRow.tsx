import { Check, Copy, ExternalLink } from "lucide-react";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";

interface LinkRowProps {
  url: string;
  copied: boolean;
  onCopy: () => void;
  /** Adds the open-in-new-tab shortcut. */
  openable?: boolean;
  copyText?: string;
}

export function LinkRow({ url, copied, onCopy, openable = false, copyText = t.network.hub.copy }: LinkRowProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        aria-label={t.network.hub.urlField}
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-border bg-mineral/50 px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <Button size="sm" variant="outline" onClick={onCopy} className="shrink-0 gap-1 text-xs">
        {copied ? <Check size={13} className="text-success-dark" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        {copyText}
      </Button>
      {openable && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={t.network.hub.openNewTab}
          title={t.network.hub.openNewTab}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:bg-mineral/50 hover:text-ink"
        >
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
