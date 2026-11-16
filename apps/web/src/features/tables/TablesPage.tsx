import { CATALOG_WRITE_ROLES, SETTLE_ROLES } from "@wakro/shared";
import { Armchair, Banknote, Coffee, Edit, Plus, Printer, QrCode, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Header } from "../../app/Header";
import { useCan } from "../../app/useCan";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { floorsOf, isPaid, KITCHEN_LABEL, kitchenStatusOf, openOrdersForTable } from "../../lib/orderStatus";
import { printTableQrSheets } from "../../lib/tableQr";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import { selectTable, useCart } from "../../state/cart";
import { deleteTable, saveTable, useTables } from "../../state/catalog";
import { useOrders } from "../../state/orders";
import type { OrderRow, TableRow } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { type SegmentedTab, SegmentedTabs } from "../../ui/SegmentedTabs";
import { PaymentModal } from "../pos/PaymentModal";
import { TableModal } from "./TableModal";
import { TableQrModal } from "./TableQrModal";

const ALL_AREAS = "__all__";
const MAX_ORDERS_SHOWN = 3;

export default function TablesPage() {
  const tables = useTables();
  const orders = useOrders();
  const cart = useCart();
  const { currentStaff } = useAuth();
  const canEditTables = useCan(CATALOG_WRITE_ROLES);
  const canSettle = useCan(SETTLE_ROLES);
  const [, setLocation] = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>(ALL_AREAS);
  const [qrTable, setQrTable] = useState<TableRow | null>(null);
  const [payingOrder, setPayingOrder] = useState<OrderRow | null>(null);

  const availableAreas = useMemo(() => floorsOf(tables), [tables]);

  const areaTabs = useMemo<SegmentedTab<string>[]>(
    () => [
      { id: ALL_AREAS, label: t.tables.allFloors(tables.length) },
      ...availableAreas.map((area) => ({
        id: area,
        label: t.tables.floorCount(area, tables.filter((tbl) => tbl.area === area).length),
      })),
    ],
    [availableAreas, tables],
  );

  const filteredTables = useMemo(() => {
    const list = areaFilter === ALL_AREAS ? tables : tables.filter((tbl) => tbl.area === areaFilter);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [tables, areaFilter]);

  const occupancy = useMemo(() => {
    const map = new Map<string, OrderRow[]>();
    for (const table of tables) map.set(table.id, openOrdersForTable(orders, table));
    return map;
  }, [orders, tables]);

  const occupiedCount = filteredTables.filter((tbl) => (occupancy.get(tbl.id)?.length ?? 0) > 0).length;
  const areaName = areaFilter === ALL_AREAS ? null : areaFilter;

  const openAdd = () => {
    setSelectedTable(null);
    setModalOpen(true);
  };

  const openEdit = (table: TableRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTable(table);
    setModalOpen(true);
  };

  const openQr = (table: TableRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setQrTable(table);
  };

  const handleDelete = async (id: string) => {
    if ((occupancy.get(id)?.length ?? 0) > 0) throw new Error(t.tables.hasActiveOrders);
    await deleteTable(id);
  };

  const selectTableAndOrder = (table: TableRow) => {
    selectTable(table);
    setLocation("/");
  };

  const printQr = (list: TableRow[]) => {
    printTableQrSheets(list).catch((err: unknown) => toast.error(err instanceof Error ? err.message : t.tables.printFailed));
  };

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title={t.tables.title} />
      <div className="flex-1 p-5 md:p-8">
        <div className="-mt-1 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-text-muted">{t.tables.subtitle}</p>
            {!canEditTables && <p className="text-xs font-semibold text-text-muted">{t.tables.readOnlyNote}</p>}
            <p className="text-xs font-semibold text-text-muted">
              <span className="text-success-dark">{t.tables.summaryFree(filteredTables.length - occupiedCount)}</span>
              {" · "}
              <span className="text-warning-dark">{t.tables.summaryOccupied(occupiedCount)}</span>
              {" · "}
              {t.tables.summaryTotal(filteredTables.length, areaName)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => printQr(filteredTables)}
              disabled={filteredTables.length === 0}
              className="gap-1.5 font-bold"
            >
              <Printer size={15} aria-hidden="true" />
              {areaName === null ? t.tables.printAll : t.tables.printArea(areaName)}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/pelayan")} className="gap-1.5 font-bold">
              <UtensilsCrossed size={15} aria-hidden="true" />
              {t.tables.waiterMode}
            </Button>
            {canEditTables && (
              <Button size="sm" onClick={openAdd} className="gap-1.5 font-bold">
                <Plus size={15} aria-hidden="true" />
                {t.tables.addTable}
              </Button>
            )}
          </div>
        </div>

        {availableAreas.length > 0 && (
          <SegmentedTabs
            tabs={areaTabs}
            value={areaFilter}
            onChange={setAreaFilter}
            label={t.tables.floorFilter}
            className="mb-6 flex-wrap"
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTables.map((table) => {
            const openOrders = occupancy.get(table.id) ?? [];
            const drafting = cart.orderType === "meja" && cart.tableId === table.id && cart.lines.length > 0;
            const isOccupied = openOrders.length > 0;
            const unpaid = openOrders.filter((o) => !isPaid(o));
            const unpaidTotal = unpaid.reduce((sum, o) => sum + o.total, 0);

            return (
              <article
                key={table.id}
                onClick={() => selectTableAndOrder(table)}
                className={cn(
                  "card-hover cursor-pointer rounded-2xl border-2 bg-surface p-5 shadow-clay transition-all hover:shadow-md",
                  isOccupied ? "border-warning bg-warning/10" : "border-success bg-success/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl text-white",
                        isOccupied ? "bg-warning" : "bg-success-dark",
                      )}
                    >
                      <Armchair size={21} aria-hidden="true" />
                    </span>
                    <Badge className="rounded-md uppercase tracking-wider text-2xs">{table.area}</Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title={t.tables.qrButtonTitle}
                      aria-label={t.tables.qrLabel(table.name)}
                      onClick={(e) => openQr(table, e)}
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-accent/20 hover:text-ink"
                    >
                      <QrCode size={17} aria-hidden="true" />
                    </button>
                    {canEditTables && (
                      <button
                        type="button"
                        aria-label={t.tables.editLabel(table.name)}
                        onClick={(e) => openEdit(table, e)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-ink/5 hover:text-ink"
                      >
                        <Edit size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <h3 className="font-display text-base font-bold tracking-tight text-ink">{table.name}</h3>
                  <Badge tone={isOccupied ? "warning" : "success"} className="text-2xs font-bold">
                    {isOccupied ? t.tables.occupied : t.tables.empty}
                  </Badge>
                </div>

                <p className="mt-0.5 text-xs text-text-muted">
                  {t.tables.seatsUnit(table.seats)}
                  {table.active === false ? ` · ${t.tables.inactive}` : ""}
                </p>

                {isOccupied ? (
                  <div className="mt-3 space-y-1.5 border-t border-dashed border-border pt-3">
                    {openOrders.slice(0, MAX_ORDERS_SHOWN).map((o) => (
                      <div key={o.no} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                        <span className="min-w-0 truncate font-semibold text-ink">
                          #{o.no} · {KITCHEN_LABEL[kitchenStatusOf(o)]}
                        </span>
                        {isPaid(o) ? (
                          <Badge tone="success" className="shrink-0 text-2xs font-bold">
                            {t.tables.paid}
                          </Badge>
                        ) : !canSettle ? (
                          <Badge tone="error" className="shrink-0 text-2xs font-bold">
                            {t.orders.unpaid}
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayingOrder(o);
                            }}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-error px-2 py-0.5 text-2xs font-bold text-white hover:bg-error/90"
                          >
                            <Banknote size={11} aria-hidden="true" /> {t.tables.pay(formatIDR(o.total))}
                          </button>
                        )}
                      </div>
                    ))}
                    {openOrders.length > MAX_ORDERS_SHOWN && (
                      <p className="text-xs2 text-text-muted">{t.tables.moreOrders(openOrders.length - MAX_ORDERS_SHOWN)}</p>
                    )}
                    {unpaid.length > 0 && <p className="text-xs2 font-bold text-error">{t.tables.unpaidTotal(formatIDR(unpaidTotal))}</p>}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-text-muted">
                    <span>{drafting ? t.tables.drafting : t.tables.freeTable}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
                      <UtensilsCrossed size={12} aria-hidden="true" /> {t.tables.openOrder}
                    </span>
                  </div>
                )}
              </article>
            );
          })}

          <article className="card-hover rounded-2xl border border-border bg-surface p-5 shadow-clay">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white">
                <Coffee size={21} aria-hidden="true" />
              </span>
              <Badge tone="dark" solid>
                {t.app.station}
              </Badge>
            </div>
            <h3 className="mt-3 font-display text-base font-bold tracking-tight text-ink">{t.tables.cashierStation}</h3>
            <p className="mt-0.5 text-xs text-text-muted">{currentStaff.name}</p>
          </article>
        </div>
      </div>

      {qrTable && <TableQrModal table={qrTable} onClose={() => setQrTable(null)} onPrint={printQr} />}

      <PaymentModal open={payingOrder !== null} order={payingOrder ?? undefined} onClose={() => setPayingOrder(null)} />

      <TableModal
        open={modalOpen}
        tableToEdit={selectedTable}
        availableAreas={availableAreas}
        onClose={() => setModalOpen(false)}
        onSave={saveTable}
        onDelete={handleDelete}
      />
    </div>
  );
}
