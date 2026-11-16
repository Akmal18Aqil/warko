import { useState } from "react";
import { toast } from "sonner";
import { t } from "../../locales/id";
import { parseTableQr, resolveTable } from "../../lib/tableQr";
import { useTables } from "../../state/catalog";
import { useAuth } from "../../state/auth";
import type { OrderRow } from "../../types/domain";
import { BarcodeScanner } from "../scanner/BarcodeScanner";
import { MenuGrid } from "./MenuGrid";
import { OrderSummary } from "./OrderSummary";
import { PayAtTableModal } from "./PayAtTableModal";
import { TablePicker } from "./TablePicker";
import type { WaiterDraft } from "./useWaiterDraft";
import { useWaiterSubmit } from "./useWaiterSubmit";

interface OrderEntryTabProps {
  draft: WaiterDraft;
  activeOrders: ReadonlyMap<string, OrderRow>;
}

/** Tab 1: pick a table, add menu items, then send the order to the kitchen or pay at the table. */
export function OrderEntryTab({ draft, activeOrders }: OrderEntryTabProps) {
  const { currentStaff } = useAuth();
  const tables = useTables();
  const submit = useWaiterSubmit(draft);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const handleScannedCode = (code: string) => {
    const key = parseTableQr(code);
    if (key !== null) {
      const matched = resolveTable(tables, key);
      if (matched) {
        draft.setSelectedTableId(matched.id);
        toast.success(t.waiter.scanTableSwitched(matched.name), { description: t.waiter.scanTableArea(matched.area) });
      } else {
        toast.error(t.waiter.scanTableUnknown);
      }
    }
    setScannerOpen(false);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7 xl:col-span-8">
        <TablePicker draft={draft} activeOrders={activeOrders} />
        <MenuGrid cart={draft.cart} onScan={() => setScannerOpen(true)} />
      </div>

      <div className="lg:col-span-5 xl:col-span-4">
        <OrderSummary
          draft={draft}
          isSubmitting={submit.isSubmitting}
          onSendToKitchen={submit.sendToKitchen}
          onPayAtTable={() => setPayOpen(true)}
        />
      </div>

      {payOpen && draft.selectedTable ? (
        <PayAtTableModal
          tableName={draft.selectedTable.name}
          waiterName={currentStaff.name}
          total={draft.cart.totals.total}
          isSubmitting={submit.isSubmitting}
          onClose={() => setPayOpen(false)}
          onConfirm={submit.payAtTable}
        />
      ) : null}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title={t.waiter.scanTitle}
        subtitle={t.waiter.scanSubtitle}
        onProduct={(item) => {
          draft.cart.add(item.id);
          toast.success(t.waiter.scanAdded(item.name));
          setScannerOpen(false);
        }}
        onScanCode={handleScannedCode}
      />
    </div>
  );
}
