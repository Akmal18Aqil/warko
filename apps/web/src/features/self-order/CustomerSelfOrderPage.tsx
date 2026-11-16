import { useParams } from "wouter";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { LoadingText } from "../../ui/Spinner";
import { CartBar } from "./CartBar";
import { CartSheet } from "./CartSheet";
import { CustomerNameCard } from "./CustomerNameCard";
import { DemoQrisModal } from "./DemoQrisModal";
import { MenuSection } from "./MenuSection";
import { OrderStatusCard } from "./OrderStatusCard";
import { PendingOrderNotice } from "./PendingOrderNotice";
import { QrisModal } from "./QrisModal";
import { ReceiptModal } from "./ReceiptModal";
import { LIVE_ORDERS_ID, SelfOrderHeader } from "./SelfOrderHeader";
import { TablePickerModal } from "./TablePickerModal";
import { useSelfOrderSession } from "./useSelfOrderSession";

/** Public QR page: a guest scans the table sticker, orders from the menu and follows the order. */
export default function CustomerSelfOrderPage() {
  const { tableId } = useParams<{ tableId?: string }>();
  const s = useSelfOrderSession(tableId);
  const { table, cart } = s;

  if (!s.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingText label={t.selfOrder.loadingMenu} />
      </div>
    );
  }

  if (s.dataSourceError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-bold text-ink">{t.selfOrder.menuUnavailable}</p>
        <p className="text-xs text-text-muted">{s.dataSourceError}</p>
        <Button onClick={() => window.location.reload()}>{t.common.retry}</Button>
      </div>
    );
  }

  return (
    <div className="service-rail-surface min-h-screen pb-28 text-ink">
      <SelfOrderHeader table={table.current} latestOrder={s.liveOrders[0]} onChangeTable={table.openPicker} />

      <main className="mx-auto max-w-lg space-y-3.5 px-4 pt-4">
        <CustomerNameCard name={s.customerName} onNameChange={s.setCustomerName} onChangeTable={table.openPicker} />

        {s.pendingOrder && <PendingOrderNotice submitting={s.submitting} onRetry={() => void s.retryPendingOrder()} />}

        {s.liveOrders.length > 0 && (
          <section id={LIVE_ORDERS_ID} className="space-y-3">
            {s.liveOrders.map((order) => (
              <OrderStatusCard
                key={order.no}
                order={order}
                qrisAvailable={s.qris.available}
                onReceipt={() => s.openReceipt(order)}
                onPayQris={() => s.payPlacedOrderQris(order.no)}
              />
            ))}
          </section>
        )}

        <MenuSection products={s.products} categories={s.categories} lines={cart.lines} onAdd={cart.add} onDecrease={cart.decrease} />
      </main>

      {cart.totals.count > 0 && (
        <CartBar count={cart.totals.count} total={cart.totals.total} tableName={table.current?.name} onOpen={() => s.setCartOpen(true)} />
      )}

      {s.cartOpen && (
        <CartSheet
          lines={cart.lines}
          totals={cart.totals}
          products={s.products}
          pricing={s.pricing}
          table={table.current}
          customerName={s.customerName}
          qrisAvailable={s.qris.available}
          qrisIsDemo={!s.isPublicCustomer}
          submitting={s.submitting}
          onClose={() => s.setCartOpen(false)}
          onAdd={cart.add}
          onDecrease={cart.decrease}
          onSetNote={cart.setNote}
          onPayQris={() => void s.payQris()}
          onPayCashier={() => void s.payAtCashier()}
        />
      )}

      {s.demoQris && (
        <DemoQrisModal
          total={s.demoQris.total}
          submitting={s.demoQris.submitting}
          onConfirm={() => void s.demoQris?.confirm()}
          onClose={s.demoQris.close}
        />
      )}

      {s.qris.orderNo !== null && <QrisModal orderNo={s.qris.orderNo} charge={s.qris.charge} image={s.qris.image} onClose={s.qris.close} />}

      {s.receipt && <ReceiptModal order={s.receipt.order} onClose={s.receipt.close} onPrint={s.receipt.print} />}

      {table.pickerOpen && (
        <TablePickerModal
          tables={table.activeTables}
          floors={table.floors}
          current={table.current}
          onSelect={table.select}
          onClose={table.closePicker}
        />
      )}
    </div>
  );
}
