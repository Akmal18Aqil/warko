import type { OrderRow } from "../lib/db";
import { receiptFromOrder } from "../lib/receipt";
import { cn } from "../lib/cn";

/** On-screen e-receipt (customer digital receipt and cashier preview). */
export function OrderReceiptView({ order, className }: { order: OrderRow; className?: string }) {
  const r = receiptFromOrder(order);
  return (
    <div className={cn("rounded-2xl border border-dashed border-ink/25 bg-white p-4 font-mono text-xs text-ink", className)}>
      <div className="text-center">
        <p className="font-display text-base font-bold tracking-tight">WAKRO Digital</p>
        <p className="text-[10px] uppercase tracking-widest text-ink/55">Warung WakRo Baru</p>
      </div>
      <div className="my-2 border-t border-dashed border-ink/25" />
      <p className="font-bold">Pesanan #{r.orderNo}</p>
      {r.details.map((line) => (
        <p key={line} className="text-ink/65">
          {line}
        </p>
      ))}
      <div className="my-2 border-t border-dashed border-ink/25" />
      <ul className="space-y-1">
        {r.lines.map((line, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="min-w-0">
              {line.qty}× {line.name}
              {line.note ? <span className="block text-[10px] text-ink/50">({line.note})</span> : null}
            </span>
            <span className="shrink-0">{line.amount}</span>
          </li>
        ))}
      </ul>
      <div className="my-2 border-t border-dashed border-ink/25" />
      {r.summary.map((row) => (
        <p key={row.label} className="flex justify-between text-ink/70">
          <span>{row.label}</span>
          <span>{row.amount}</span>
        </p>
      ))}
      <p className="mt-1 flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{r.total}</span>
      </p>
      {r.payment.map((row) => (
        <p key={row.label} className={cn("flex justify-between", r.paid ? "text-emerald-700" : "font-bold text-coral")}>
          <span>{row.label}</span>
          <span>{row.amount}</span>
        </p>
      ))}
      <div className="my-2 border-t border-dashed border-ink/25" />
      <p className="text-center text-[10px] text-ink/55">
        {r.paid ? "Simpan struk ini sebagai bukti pembayaran." : "Silakan bayar di kasir dengan menyebutkan nomor pesanan."}
      </p>
    </div>
  );
}
