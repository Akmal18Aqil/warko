import { useMemo, useState } from "react";
import { ClipboardList, LayoutGrid, Sparkles, UtensilsCrossed } from "lucide-react";
import { FocusModeHeader } from "../../app/FocusModeHeader";
import { t } from "../../locales/id";
import { cn } from "../../lib/cn";
import { isHandledBy, kitchenStatusOf } from "../../lib/orderStatus";
import { useAuth } from "../../state/auth";
import { useTables } from "../../state/catalog";
import { useOrders } from "../../state/orders";
import { Badge } from "../../ui/Badge";
import { SegmentedTabs, type SegmentedTab } from "../../ui/SegmentedTabs";
import { FloorMapTab } from "./FloorMapTab";
import { MyOrdersTab } from "./MyOrdersTab";
import { OrderEntryTab } from "./OrderEntryTab";
import { latestOpenOrderByTable } from "./tableOccupancy";
import { useWaiterDraft } from "./useWaiterDraft";

type WaiterTab = "order" | "my-orders" | "floor-map";

export default function WaiterOrderPage() {
  const { currentStaff, openSwitchModal } = useAuth();
  const tables = useTables();
  const orders = useOrders();
  const draft = useWaiterDraft();
  const [activeTab, setActiveTab] = useState<WaiterTab>("order");

  const activeOrders = useMemo(() => latestOpenOrderByTable(orders, tables), [orders, tables]);
  const myActiveOrders = useMemo(
    () => orders.filter((o) => isHandledBy(o, currentStaff) && kitchenStatusOf(o) !== "served"),
    [orders, currentStaff],
  );
  const hasReadyOrder = myActiveOrders.some((o) => kitchenStatusOf(o) === "ready");
  const cartCount = draft.cart.totals.count;

  const tabs: SegmentedTab<WaiterTab>[] = [
    {
      id: "order",
      label: t.waiter.tabOrder,
      icon: <UtensilsCrossed size={14} aria-hidden="true" />,
      badge:
        cartCount > 0 ? (
          <Badge solid tone="accent" className="min-w-4 justify-center px-1 py-0 text-2xs">
            {cartCount}
          </Badge>
        ) : undefined,
    },
    {
      id: "my-orders",
      label: t.waiter.tabMyOrders,
      icon: <ClipboardList size={14} aria-hidden="true" />,
      badge:
        myActiveOrders.length > 0 ? (
          <Badge
            solid
            tone={hasReadyOrder ? "success" : "neutral"}
            className={cn("min-w-4 justify-center px-1 py-0 text-2xs", hasReadyOrder && "animate-pulse")}
          >
            {myActiveOrders.length}
          </Badge>
        ) : undefined,
    },
    {
      id: "floor-map",
      label: t.waiter.tabFloorMap(tables.length),
      icon: <LayoutGrid size={14} aria-hidden="true" />,
    },
  ];

  return (
    <div className="service-rail-surface flex min-h-screen min-w-0 flex-col overflow-x-hidden">
      <FocusModeHeader title={t.waiter.title} subtitle={t.waiter.subtitle(currentStaff.name)} roleType="pelayan" />

      <div className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 pb-28 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-surface p-3.5 shadow-clay">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold shadow-xs",
                currentStaff.avatarColor,
              )}
              aria-hidden="true"
            >
              {currentStaff.initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-ink">{currentStaff.name}</p>
                <Badge tone="accent" className="px-2 py-0.5 text-2xs font-bold">
                  {currentStaff.title}
                </Badge>
                <button
                  type="button"
                  onClick={openSwitchModal}
                  className="flex items-center gap-1 text-xs2 font-semibold text-text-muted underline hover:text-ink"
                >
                  <Sparkles size={12} aria-hidden="true" className="text-warning-dark" />
                  {t.waiter.switchAccount}
                </button>
              </div>
              <p className="mt-0.5 text-xs2 text-text-muted">{t.waiter.draftSavedFor(currentStaff.name)}</p>
            </div>
          </div>

          <SegmentedTabs tabs={tabs} value={activeTab} onChange={setActiveTab} label={t.waiter.tabsLabel} />
        </div>

        {activeTab === "order" && <OrderEntryTab draft={draft} activeOrders={activeOrders} />}
        {activeTab === "my-orders" && <MyOrdersTab orders={myActiveOrders} onStartOrder={() => setActiveTab("order")} />}
        {activeTab === "floor-map" && (
          <FloorMapTab
            activeOrders={activeOrders}
            onOpenTable={(tableId) => {
              draft.setSelectedTableId(tableId);
              setActiveTab("order");
            }}
          />
        )}
      </div>
    </div>
  );
}
