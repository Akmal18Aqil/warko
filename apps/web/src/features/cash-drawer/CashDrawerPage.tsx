import type { CashMovementType } from "@wakro/shared";
import { MinusCircle, PlusCircle, Vault } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "../../app/Header";
import { playDrawerBeep } from "../../lib/audioFeedback";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import type { CashMovementRow, ShiftRecord } from "../../types/domain";
import { Button } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { CashMetrics } from "./CashMetrics";
import { CloseShiftModal } from "./CloseShiftModal";
import { DeleteMovementModal } from "./DeleteMovementModal";
import { MovementModal } from "./MovementModal";
import { MovementTable } from "./MovementTable";
import { OpenShiftModal } from "./OpenShiftModal";
import { ShiftHistoryTable } from "./ShiftHistoryTable";
import { ShiftStatusBanner } from "./ShiftStatusBanner";
import { useCashDrawer } from "./useCashDrawer";
import { ZReportPreview } from "./ZReportPreview";

type Tab = "movements" | "history";

type Overlay =
  | { kind: "movement"; type: CashMovementType }
  | { kind: "openShift" }
  | { kind: "closeShift" }
  | { kind: "deleteMovement"; movement: CashMovementRow }
  | { kind: "report"; shift: ShiftRecord };

export default function CashDrawerPage() {
  const text = t.cashDrawer;
  const { currentStaff } = useAuth();
  const { activeShift, movements, figures, history } = useCashDrawer();
  const [tab, setTab] = useState<Tab>("movements");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const closeOverlay = () => setOverlay(null);

  const openDrawer = () => {
    playDrawerBeep();
    toast.success(text.drawerBeep.title, {
      description: text.drawerBeep.body,
      icon: <Vault size={20} className="text-accent-dark" aria-hidden="true" />,
    });
  };

  // The server refuses edits to a closed shift's movements for anyone but an admin, so hide what would fail.
  const canDelete = (movement: CashMovementRow) => currentStaff.role === "admin" || (activeShift !== null && movement.shiftId === activeShift.id);

  const tabs = [
    { id: "movements", label: text.tabs.movements(movements.length) },
    { id: "history", label: text.tabs.history(history.length) },
  ] as const;

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title={text.pageTitle} />

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-5 md:p-8">
        <ShiftStatusBanner
          shift={activeShift}
          staffName={currentStaff.name}
          onOpenDrawer={openDrawer}
          onOpenShift={() => setOverlay({ kind: "openShift" })}
          onCloseShift={() => setOverlay({ kind: "closeShift" })}
        />

        {activeShift && figures ? (
          <>
            <CashMetrics startingCash={activeShift.startingCash} figures={figures} />
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOverlay({ kind: "movement", type: "CASH_IN" })}
                className="gap-2 border-success/30 bg-success/10 font-semibold text-success-dark hover:bg-success/20"
              >
                <PlusCircle size={15} aria-hidden="true" />
                {text.actions.cashIn}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOverlay({ kind: "movement", type: "CASH_OUT" })}
                className="gap-2 border-error/30 bg-error/10 font-semibold text-error-dark hover:bg-error/20"
              >
                <MinusCircle size={15} aria-hidden="true" />
                {text.actions.cashOut}
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-ink/10 bg-surface shadow-clay">
            <Empty
              icon={<Vault size={28} aria-hidden="true" />}
              title={text.noShift.title}
              subtitle={text.noShift.body}
              action={
                <Button size="sm" onClick={() => setOverlay({ kind: "openShift" })} className="gap-2 font-semibold">
                  <PlusCircle size={16} aria-hidden="true" />
                  {text.noShift.action}
                </Button>
              }
            />
          </div>
        )}

        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} label={text.tabs.label} className="sm:w-fit" />

        {tab === "movements" ? (
          <MovementTable
            movements={movements}
            canDelete={canDelete}
            onDelete={(movement) => setOverlay({ kind: "deleteMovement", movement })}
          />
        ) : (
          <ShiftHistoryTable shifts={history} onViewReport={(shift) => setOverlay({ kind: "report", shift })} />
        )}
      </div>

      {overlay?.kind === "movement" ? <MovementModal initialType={overlay.type} onClose={closeOverlay} /> : null}
      {overlay?.kind === "openShift" ? <OpenShiftModal onClose={closeOverlay} /> : null}
      {overlay?.kind === "closeShift" && figures ? (
        <CloseShiftModal
          expectedCash={figures.expected}
          onClose={closeOverlay}
          onClosed={(shift) => setOverlay({ kind: "report", shift })}
        />
      ) : null}
      {overlay?.kind === "deleteMovement" ? <DeleteMovementModal movement={overlay.movement} onClose={closeOverlay} /> : null}
      {overlay?.kind === "report" ? <ZReportPreview shift={overlay.shift} onClose={closeOverlay} /> : null}
    </div>
  );
}
