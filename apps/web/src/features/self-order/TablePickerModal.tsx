import { MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import type { TableRow } from "../../types/domain";
import { Modal, ModalHeader } from "../../ui/Modal";
import { SegmentedTabs } from "../../ui/SegmentedTabs";

interface TablePickerModalProps {
  tables: TableRow[];
  floors: string[];
  current: TableRow | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Fallback when the QR is missing or unknown: pick floor, then table. */
export function TablePickerModal({ tables, floors, current, onSelect, onClose }: TablePickerModalProps) {
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const floor = floorFilter ?? current?.area ?? floors[0];

  return (
    <Modal onClose={onClose} placement="sheet" size="md">
      <ModalHeader title={t.selfOrder.table.title} icon={<MapPin size={16} aria-hidden="true" />} />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs text-text-muted">{t.selfOrder.table.hint}</p>
        {floors.length > 0 && (
          <SegmentedTabs
            tabs={floors.map((name) => ({ id: name, label: name }))}
            value={floor}
            onChange={setFloorFilter}
            label={t.selfOrder.table.floors}
            className="flex-wrap"
          />
        )}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tables
            .filter((table) => table.area === floor)
            .map((table) => {
              const selected = table.id === current?.id;
              return (
                <button
                  key={table.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onSelect(table.id);
                    onClose();
                    toast.success(t.selfOrder.table.active(table.name, table.area));
                  }}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-colors",
                    selected
                      ? "border-ink bg-ink text-white ring-2 ring-accent/50"
                      : "border-border bg-mineral text-ink hover:border-border-hover hover:bg-surface",
                  )}
                >
                  <p className="text-xs font-bold">{table.name}</p>
                  <p className="mt-0.5 text-2xs opacity-60">{t.selfOrder.table.seats(table.seats)}</p>
                </button>
              );
            })}
        </div>
        {tables.length === 0 && <p className="text-xs text-error">{t.selfOrder.table.noActive}</p>}
      </div>
    </Modal>
  );
}
