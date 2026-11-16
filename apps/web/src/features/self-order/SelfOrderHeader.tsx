import { Clock, MapPin } from "lucide-react";
import { STORE_TITLE } from "../../lib/storeProfile";
import { t } from "../../locales/id";
import type { OrderRow, TableRow } from "../../types/domain";

/** Anchor of the live order list on the page, so the header badge can scroll to it. */
export const LIVE_ORDERS_ID = "live-order-tracker";

interface SelfOrderHeaderProps {
  table: TableRow | null;
  latestOrder: OrderRow | undefined;
  onChangeTable: () => void;
}

export function SelfOrderHeader({ table, latestOrder, onChangeTable }: SelfOrderHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-ink text-white shadow-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <h1 className="text-sm font-bold tracking-tight text-white">{STORE_TITLE}</h1>
          <button
            type="button"
            onClick={onChangeTable}
            className="mt-0.5 flex items-center gap-1 text-xs font-bold text-accent hover:underline"
          >
            <MapPin size={12} aria-hidden="true" />
            <span>{table ? t.selfOrder.header.tableLabel(table.name, table.area) : t.selfOrder.header.chooseTable}</span>
          </button>
        </div>
        {latestOrder && (
          <button
            type="button"
            onClick={() => document.getElementById(LIVE_ORDERS_ID)?.scrollIntoView({ behavior: "smooth" })}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white shadow-sm"
          >
            <Clock size={13} aria-hidden="true" />
            {t.selfOrder.header.statusOf(latestOrder.no)}
          </button>
        )}
      </div>
    </header>
  );
}
