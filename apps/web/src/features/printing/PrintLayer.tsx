import { formatIDR } from "../../data/menu";
import { receiptFromOrder } from "../../lib/receipt";
import { STORE_PROFILE } from "../../lib/storeProfile";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import { useCart } from "../../state/cart";
import { useProducts } from "../../state/catalog";
import { useNextOrderNo } from "../../state/orders";
import { usePricing } from "../../state/pricing";
import { type ReportPayload, type ReportRow, usePrint, type ZReportPayload } from "../../state/print";
import type { OrderRow } from "../../types/domain";

/** The only element that survives `window.print()`: everything else is hidden by the print stylesheet. */
export function PrintLayer() {
  const { job } = usePrint();
  switch (job.kind) {
    case "report":
      return <SalesReportPrint report={job.report} />;
    case "zreport":
      return <ZReportPrint report={job.report} />;
    case "order":
      return <OrderReceiptPrint order={job.order} />;
    case "cart":
      return <CartReceiptPrint />;
  }
}

function ReceiptHead() {
  return (
    <div className="rp-head">
      <p className="rp-logo">{STORE_PROFILE.brand}</p>
      <p className="rp-tagline">{STORE_PROFILE.outlet.toUpperCase()}</p>
    </div>
  );
}

function ReceiptFoot({ paid = true }: { paid?: boolean }) {
  return (
    <>
      <p className="rp-center rp-muted">{t.printing.receipt.thanks(STORE_PROFILE.outlet)}</p>
      <p className="rp-center rp-muted">{paid ? t.printing.receipt.keepReceipt : t.printing.receipt.payAtCashier}</p>
    </>
  );
}

function SummaryRows({ rows }: { rows: ReportRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <tr key={row.label} className={row.strong ? "rp-strong" : undefined}>
          <td>{row.label}</td>
          <td className="rp-amt">{row.value}</td>
        </tr>
      ))}
    </>
  );
}

function SalesReportPrint({ report }: { report: ReportPayload }) {
  return (
    <div id="print-root" aria-hidden="true">
      <div className="report-print">
        <h1>{report.title}</h1>
        <p className="rp-sub">{report.period}</p>
        <table>
          <thead>
            <tr>
              <th>{t.printing.salesReport.colDate}</th>
              <th className="num">{t.printing.salesReport.colOrders}</th>
              <th className="num">{t.printing.salesReport.colItems}</th>
              <th className="num">{t.printing.salesReport.colSales}</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="num">{row.orders}</td>
                <td className="num">{row.items}</td>
                <td className="num">{row.sales}</td>
              </tr>
            ))}
            <tr className="report-total">
              <td>{t.printing.salesReport.totalRow}</td>
              <td className="num">{report.totalOrders}</td>
              <td className="num" />
              <td className="num">{report.totalSales}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ZReportPrint({ report }: { report: ZReportPayload }) {
  return (
    <div id="print-root" aria-hidden="true">
      <div className="receipt-print">
        <ReceiptHead />
        <div className="rp-sep" />
        <p className="rp-strong rp-center">{t.printing.zReport.title}</p>
        <table className="rp-summary">
          <tbody>
            <SummaryRows rows={report.details} />
          </tbody>
        </table>
        <div className="rp-sep" />
        <table className="rp-summary">
          <tbody>
            <SummaryRows rows={report.figures} />
          </tbody>
        </table>
        {report.denominations.length > 0 ? (
          <>
            <div className="rp-sep" />
            <p className="rp-strong">{t.printing.zReport.denominations}</p>
            <table className="rp-summary">
              <tbody>
                <SummaryRows rows={report.denominations} />
              </tbody>
            </table>
          </>
        ) : null}
        {report.notes ? (
          <>
            <div className="rp-sep" />
            <p className="rp-muted">
              {t.printing.zReport.notes}: {report.notes}
            </p>
          </>
        ) : null}
        <div className="rp-sep" />
        <p className="rp-muted">{t.printing.zReport.signature}:</p>
        <p className="rp-muted">&nbsp;</p>
        <p className="rp-muted">&nbsp;</p>
      </div>
    </div>
  );
}

function OrderReceiptPrint({ order }: { order: OrderRow }) {
  const r = receiptFromOrder(order);
  return (
    <div id="print-root" aria-hidden="true">
      <div className="receipt-print">
        <ReceiptHead />
        <div className="rp-sep" />
        <p className="rp-strong">
          {t.printing.receipt.orderPrefix} {r.orderNo}
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
                  <span className="rp-unit"> {t.printing.receipt.unitPrice(line.unit)}</span>
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
              <td>{t.printing.receipt.totalLabel}</td>
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
        <ReceiptFoot paid={r.paid} />
      </div>
    </div>
  );
}

/** Live preview ticket of the cashier cart: the date is read at render time and every charge line is listed so the rows add up to the total. */
function CartReceiptPrint() {
  const { orderType, selectedTable, guests, lines, totals } = useCart();
  const { currentStaff } = useAuth();
  const pricing = usePricing();
  const orderNo = useNextOrderNo();
  const products = useProducts();
  const hasItems = lines.length > 0;
  const text = t.printing.receipt;

  return (
    <div id="print-root" aria-hidden="true">
      <div className="receipt-print">
        <ReceiptHead />
        <div className="rp-sep" />
        <p className="rp-strong">
          {text.orderPrefix} {orderNo} ·{" "}
          {orderType === "bawa-pulang"
            ? text.orderTypeTakeaway
            : text.orderTypeTable(selectedTable ? `${selectedTable.name} · ${selectedTable.area}` : "-")}
          {orderType === "meja" ? ` · ${guests} ${text.guestsUnit}` : ""}
        </p>
        <p className="rp-muted">
          {t.app.header.today(new Date())}
          <br />
          {text.cashierLine(currentStaff.name)}
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
                        <span className="rp-unit"> {text.unitPrice(formatIDR(item.price))}</span>
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
                  <td>{text.subtotal}</td>
                  <td className="rp-amt">{formatIDR(totals.rawSubtotal)}</td>
                </tr>
                {totals.discountAmount > 0 ? (
                  <tr>
                    <td>{text.discount}</td>
                    <td className="rp-amt">-{formatIDR(totals.discountAmount)}</td>
                  </tr>
                ) : null}
                {totals.serviceCharge > 0 ? (
                  <tr>
                    <td>{text.serviceCharge(pricing.serviceChargeRate)}</td>
                    <td className="rp-amt">{formatIDR(totals.serviceCharge)}</td>
                  </tr>
                ) : null}
                {totals.tax > 0 ? (
                  <tr>
                    <td>{text.tax(pricing.taxRate)}</td>
                    <td className="rp-amt">{formatIDR(totals.tax)}</td>
                  </tr>
                ) : null}
                <tr className="rp-total-row">
                  <td>{text.totalLabel}</td>
                  <td className="rp-amt">{formatIDR(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p className="rp-muted rp-center">{text.sampleNote}</p>
        )}

        <div className="rp-sep" />
        <ReceiptFoot />
      </div>
    </div>
  );
}
