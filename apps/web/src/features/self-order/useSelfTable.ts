import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTables } from "../../state/catalog";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { resolveTable } from "../../lib/tableQr";
import { floorsOf } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import type { TableRow } from "../../types/domain";

export interface SelfTable {
  activeTables: TableRow[];
  floors: string[];
  /** The table the guest sits at, or null until one is chosen. */
  current: TableRow | null;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  select: (id: string) => void;
}

/** Which table the guest sits at: the QR in the URL wins over the remembered one, otherwise they pick. */
export function useSelfTable(ready: boolean, paramTableId: string | undefined): SelfTable {
  const tables = useTables();
  const activeTables = useMemo(() => tables.filter((table) => table.active !== false), [tables]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.selfTable));
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const fromUrl = resolveTable(activeTables, paramTableId);
    if (fromUrl) {
      setSelectedTableId(fromUrl.id);
      return;
    }
    if (paramTableId) toast.error(t.selfOrder.table.unknownQr);
    if (!activeTables.some((table) => table.id === selectedTableId)) {
      setSelectedTableId(null);
      setPickerOpen(true);
    }
    // selectedTableId is intentionally not a dependency: resolve once per load / URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, paramTableId, activeTables]);

  useEffect(() => {
    if (selectedTableId) localStorage.setItem(STORAGE_KEYS.selfTable, selectedTableId);
  }, [selectedTableId]);

  const current = activeTables.find((table) => table.id === selectedTableId) ?? null;
  const floors = useMemo(() => floorsOf(activeTables), [activeTables]);

  return {
    activeTables,
    floors,
    current,
    pickerOpen,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
    select: (id: string) => setSelectedTableId(id),
  };
}
