import { formatIDR } from "../data/menu";
import { t } from "../locales/en";
import { receiptFromOrder } from "../lib/receipt";
import { useCart } from "../state/cart";
import { useProducts } from "../state/catalog";
import { useNextOrderNo } from "../state/orders";
import { usePrint } from "./PrintContext";

export function PrintLayer() {
  const print = usePrint();

  if (print.mode === "report" && print.report) {
    const r = print.report;
    return (
      <div id="print-root" aria-hidden="true">
        <div className="report-print">
          <h1>{r.title}</h1>
          <p className="rp-sub">{r.period}</p>
          <table>
            <thead>
              <tr>
                <th>{t.reportsPage.colDate}</th>
                <th className="num">{t.reportsPage.colOrders}</th>
                <th className="num">{t.reportsPage.colItems}</th>
                <th className="num">{t.reportsPage.colSales}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="num">{row.orders}</td>
                  <td className="num">{row.items}</td>
                  <td className="num">{row.sales}</td>
                </tr>
              ))}
              <tr className="report-total">
                <td>{t.reportsPage.totalRow}</td>
                <td className="num">{r.totalOrders}</td>
                <td className="num" />
                <td className="num">{r.totalSales}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (print.mode === "order" && print.order) return <OrderReceiptPrint />;

  return <ReceiptPrint />;
}

function OrderReceiptPrint() {
  const { order } = usePrint();
  const r = receiptFromOrder(order!);
  return (
    <div id="print-root" aria-hidden="true">
      <div className="receipt-print">
        <div className="rp-head">
          <p className="rp-logo">{t.appName}</p>
          <p className="rp-tagline">{t.receipt.headerTagline}</p>
        </div>
        <div className="rp-sep" />
        <p className="rp-strong">
          {t.cart.orderPrefix} {r.orderNo}
        </p>
        <p className="rp-muted">
          {r.details.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </p>
        <div className="rp-sep" />
        <table className="rp-items">
          <tbody>
            {r.lines.map((line, i) => (
              <tr key={i}>
                <td className="rp-qty">{line.qty}×</td>
                <td className="rp-name">
                  {line.name}
                  {line.note ? <span className="rp-unit"> ({line.note})</span> : null}
                  <span className="rp-unit"> {t.receipt.unitPrice(line.unit)}</span>
                </td>
                <td className="rp-amt">{line.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="rp-sep" />
        <table className="rp-summary">
          <tbody>
            {r.summary.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="rp-amt">{row.amount}</td>
              </tr>
            ))}
            <tr className="rp-total-row">
              <td>{t.receipt.totalLabel}</td>
              <td className="rp-amt">{r.total}</td>
            </tr>
            {r.payment.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="rp-amt">{row.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="rp-sep" />
        <p className="rp-center rp-muted">{t.receipt.thanks}</p>
        <p className="rp-center rp-muted">{t.receipt.keepReceipt}</p>
      </div>
    </div>
  );
}

function ReceiptPrint() {
  const { orderType, selectedTable, guests, lines, totals } = useCart();
  const orderNo = useNextOrderNo();
  const products = useProducts();
  const hasItems = lines.length > 0;

  return (
    <div id="print-root" aria-hidden="true">
      <div className="receipt-print">
        <div className="rp-head">
          <p className="rp-logo">{t.appName}</p>
          <p className="rp-tagline">{t.receipt.headerTagline}</p>
        </div>

        <div className="rp-sep" />

        <p className="rp-strong">
          {t.cart.orderPrefix} {orderNo} ·{" "}
          {orderType === "bawa-pulang"
            ? t.receipt.orderTypeTakeaway
            : t.receipt.orderTypeTable(selectedTable ? `${selectedTable.name} · ${selectedTable.area}` : "-")}
          {orderType === "meja" ? ` · ${guests} ${t.cart.guestsUnit}` : ""}
        </p>
        <p className="rp-muted">
          {t.header.dateToday}
          <br />
          {t.receipt.cashierLine(t.cashier.name)}
        </p>

        <div className="rp-sep" />

        {hasItems ? (
          <>
            <table className="rp-items">
              <tbody>
                {lines.map((line) => {
                  const item = products.find((p) => p.id === line.itemId);
                  if (!item) return null;
                  return (
                    <tr key={line.itemId}>
                      <td className="rp-qty">{line.qty}×</td>
                      <td className="rp-name">
                        {item.name}
                        <span className="rp-unit">
                          {" "}
                          {t.receipt.unitPrice(formatIDR(item.price))}
                        </span>
                      </td>
                      <td className="rp-amt">{formatIDR(item.price * line.qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="rp-sep" />

            <table className="rp-summary">
              <tbody>
                <tr>
                  <td>{t.receipt.productSubtotal}</td>
                  <td className="rp-amt">{formatIDR(totals.subtotal)}</td>
                </tr>
                <tr>
                  <td>{t.receipt.taxLabel}</td>
                  <td className="rp-amt">{formatIDR(totals.tax)}</td>
                </tr>
                <tr className="rp-total-row">
                  <td>{t.receipt.totalLabel}</td>
                  <td className="rp-amt">{formatIDR(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p className="rp-muted rp-center">{t.receipt.sampleNote}</p>
        )}

        <div className="rp-sep" />

        <p className="rp-center rp-muted">{t.receipt.thanks}</p>
        <p className="rp-center rp-muted">{t.receipt.keepReceipt}</p>
      </div>
    </div>
  );
}
