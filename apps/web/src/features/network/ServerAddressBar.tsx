import { Server, Users } from "lucide-react";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";

interface ServerAddressBarProps {
  baseUrl: string;
  peerCount: number;
  editing: boolean;
  draft: string;
  placeholder: string;
  onDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function ServerAddressBar({
  baseUrl,
  peerCount,
  editing,
  draft,
  placeholder,
  onDraftChange,
  onStartEdit,
  onCancel,
  onSave,
}: ServerAddressBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-ink/5 px-6 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Server size={15} className="text-text-muted" aria-hidden="true" />
        <span className="font-bold text-ink">{t.network.hub.serverAddress}</span>
        {editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <Input
              size="sm"
              autoFocus
              aria-label={t.network.hub.ipLabel}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={placeholder}
              wrapperClassName="w-56"
              className="font-mono font-bold"
            />
            <Button type="submit" size="sm">
              {t.network.hub.saveIp}
            </Button>
          </form>
        ) : (
          <code className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-sm font-bold text-ink">{baseUrl}</code>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={editing ? onCancel : onStartEdit}
          className="text-xs2 font-bold text-text-muted underline hover:text-ink"
        >
          {editing ? t.common.cancel : t.network.hub.editIp}
        </button>
        <span className="text-border" aria-hidden="true">
          |
        </span>
        <span className="flex items-center gap-1 text-text-muted">
          <Users size={13} aria-hidden="true" /> {t.network.hub.connectedCount(peerCount)}
        </span>
      </div>
    </div>
  );
}
