import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { floorsOf } from "../../lib/orderStatus";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { resolveTable } from "../../lib/tableQr";
import { t } from "../../locales/id";
import { useTables } from "../../state/catalog";
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
  // Read inside the resolve effect without re-running it: resolution happens once per load / URL change.
  const selectedTableIdRef = useRef(selectedTableId);
  selectedTableIdRef.current = selectedTableId;

  useEffect(() => {
    if (!ready) return;
    const fromUrl = resolveTable(activeTables, paramTableId);
    if (fromUrl) {
      setSelectedTableId(fromUrl.id);
      return;
    }
    if (paramTableId) toast.error(t.selfOrder.table.unknownQr);
    if (!activeTables.some((table) => table.id === selectedTableIdRef.current)) {
      setSelectedTableId(null);
      setPickerOpen(true);
    }
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
