import { useState } from "react";
import { t } from "../../locales/id";
import { tableOrderUrl } from "../../lib/tableQr";
import { useTables } from "../../state/catalog";
import { cn } from "../../lib/cn";
import { Empty } from "../../ui/Empty";
import { LinkRow } from "./LinkRow";
import { QrCard } from "./QrCard";
import { useQrDataUrl } from "./useQrDataUrl";

interface NetworkTableTabProps {
  baseUrl: string;
  copiedUrl: string | null;
  onCopy: (url: string, label: string) => void;
}

export function NetworkTableTab({ baseUrl, copiedUrl, onCopy }: NetworkTableTabProps) {
  const tables = useTables();
  const [selectedId, setSelectedId] = useState("");
  const table = tables.find((row) => row.id === selectedId) ?? tables[0];
  const url = table ? tableOrderUrl(table, baseUrl) : null;
  const qr = useQrDataUrl(url);

  if (!table || !url) {
    return <Empty title={t.network.hub.table.noTables} subtitle={t.network.hub.table.noTablesBody} />;
  }

  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
      <QrCard
        qr={qr}
        alt={t.network.hub.table.qrAlt(table.name)}
        title={t.network.hub.table.qrTitle(table.name, table.area)}
        body={t.network.hub.table.qrBody}
      />

      <div className="space-y-4">
        <div className="space-y-2.5 rounded-xl border border-border bg-surface p-4 shadow-clay">
          <div className="flex items-center justify-between">
            <span id="network-table-picker" className="text-xs font-bold uppercase tracking-wider text-text-muted">
              {t.network.hub.table.pick}
            </span>
            <span className="text-xs2 font-semibold text-text-light">{t.network.hub.table.count(tables.length)}</span>
          </div>
          <div role="radiogroup" aria-labelledby="network-table-picker" className="flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
            {tables.map((row) => {
              const selected = row.id === table.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    selected
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-mineral/40 text-ink hover:border-border-hover hover:bg-surface",
                  )}
                >
                  <span>{row.name}</span>
                  {row.area && (
                    <span className={cn("rounded px-1.5 py-0.5 text-2xs font-medium", selected ? "bg-white/15" : "bg-ink/10 text-text-muted")}>
                      {row.area}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <LinkRow
          url={url}
          copied={copiedUrl === url}
          onCopy={() => onCopy(url, t.network.hub.table.copyLabel(table.name))}
          copyText={t.network.hub.copyLink}
        />
      </div>
    </div>
  );
}
