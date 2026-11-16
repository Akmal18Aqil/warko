import { type ImportCounts, type ImportRows, readBackup, writeImport } from "../data/backup";
import type { MenuItem, MenuKind } from "../data/menu";
import type { CashMovementRow, CategoryRow, OrderRow, ShiftRecord, TableRow } from "../types/domain";
import { isPaid, tableLabel } from "./orderStatus";
import { PAY_METHOD_LABEL } from "./receipt";
import { STORE_PROFILE } from "./storeProfile";
import { broadcastSync } from "./syncBus";

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: string | number | undefined): string {
  const s = String(value ?? "");
  return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(headers: string[], rows: Array<Array<string | number | undefined>>): string {
  return [headers.map(csvEscape).join(";"), ...rows.map((r) => r.map(csvEscape).join(";"))].join("\r\n");
}

export async function exportBackupJson(): Promise<void> {
  const payload = await readBackup();
  download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `wakro-cadangan-lengkap-${dateStamp()}.json`);
}

export async function exportProductsCsv(products: MenuItem[]): Promise<void> {
  const csv = toCsv(
    ["id", "barcode", "nama", "deskripsi", "harga", "kategori", "jenis", "menit", "stok"],
    products.map((p) => [p.id, p.barcode, p.name, p.description, p.price, p.category, p.kind, p.prepMinutes, p.stock ?? ""]),
  );
  download(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), `wakro-produk-${dateStamp()}.csv`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowsOf<T>(value: unknown, isValid: (row: Record<string, unknown>) => boolean): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is T & Record<string, unknown> => isRecord(row) && isValid(row)) as T[];
}

const isProduct = (p: Record<string, unknown>) => typeof p.id === "string" && typeof p.name === "string" && typeof p.price === "number";
const isOrder = (o: Record<string, unknown>) => typeof o.no === "number" && typeof o.total === "number";
const isTable = (t: Record<string, unknown>) => typeof t.id === "string" && typeof t.name === "string";
const isCategory = (c: Record<string, unknown>) => typeof c.id === "string" && typeof c.name === "string";
const isMovement = (m: Record<string, unknown>) =>
  typeof m.id === "string" && typeof m.amount === "number" && (m.type === "CASH_IN" || m.type === "CASH_OUT");

const isShift = (s: Record<string, unknown>) =>
  typeof s.id === "string" && typeof s.openedAt === "number" && (s.status === "OPEN" || s.status === "CLOSED");

const MENU_KINDS: readonly MenuKind[] = ["Minuman", "Makanan", "Camilan"];

function parseJsonBackup(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gagal membaca file JSON. Berkas mungkin rusak atau tidak valid.");
  }
  // A bare array is a product list; an object is a full backup.
  const source: Record<string, unknown> = isRecord(parsed) ? parsed : { products: parsed };
  return {
    products: rowsOf<MenuItem>(source.products, isProduct),
    orders: rowsOf<OrderRow>(source.orders, isOrder),
    tables: rowsOf<TableRow>(source.tables, isTable),
    categories: rowsOf<CategoryRow>(source.categories, isCategory),
    cashMovements: rowsOf<CashMovementRow>(source.cashMovements, isMovement),
    shifts: rowsOf<ShiftRecord>(source.shifts, isShift),
  };
}

function parseProductsCsv(text: string): MenuItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    throw new Error("File CSV kosong atau tidak memiliki baris data produk.");
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.slice(1).map((line) => line.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim()));

  return rows
    .filter((r) => r.length >= 3 && r[1])
    .map((r, index) => {
      const kind = MENU_KINDS.find((k) => k === r[6]) ?? "Makanan";
      return {
        id: r[0] || `item-csv-${Date.now()}-${index}`,
        barcode: r[1] || `899${Date.now().toString().slice(-9)}${index}`,
        name: r[2] || "Produk Impor",
        description: r[3] || "Deskripsi produk",
        price: Number.parseInt((r[4] || "0").replace(/\D/g, ""), 10) || 10000,
        category: r[5] || "Makanan",
        kind,
        prepMinutes: Number.parseInt(r[7] || "5", 10) || 5,
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&q=70",
      };
    });
}

/** Writes the rows, then tells other tabs to reload everything: an import can touch every slice of state. */
async function importedAndBroadcast(rows: ImportRows): Promise<ImportCounts> {
  const counts = await writeImport(rows);
  broadcastSync({ type: "DATA_IMPORTED" });
  return counts;
}

/** Restores a backup into the browser database (local mode only). */
export async function importBackupFile(file: File): Promise<ImportCounts> {
  const isJson = file.name.endsWith(".json");
  const isCsv = file.name.endsWith(".csv");

  if (!isJson && !isCsv) {
    throw new Error("Format berkas tidak didukung. Harap unggah file .json atau .csv.");
  }

  const text = await file.text();
  const empty = { products: [], orders: [], tables: [], categories: [], cashMovements: [], shifts: [] };

  if (isJson) {
    const rows = parseJsonBackup(text);
    const total = Object.values(rows).reduce((sum, list) => sum + list.length, 0);
    if (total === 0) {
      throw new Error("Tidak ada data produk, pesanan, meja, kategori, shift, atau mutasi kas yang valid dalam berkas ini.");
    }
    return importedAndBroadcast(rows);
  }

  const products = parseProductsCsv(text);
  if (products.length === 0) {
    throw new Error("Tidak ada baris data produk yang valid dalam file CSV.");
  }
  return importedAndBroadcast({ ...empty, products });
}

// ---- owner reports ----------------------------------------------------------

/** Local calendar day key (YYYY-MM-DD) in the device's time zone, not UTC. */
function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type SalesBucket = { key: string; label: string; orders: number; items: number; sales: number };
export type TopProduct = { name: string; qty: number; sales: number };

export type SalesSummary = {
  /** Paid orders whose payment falls in the range, newest first. */
  paid: OrderRow[];
  revenue: number;
  transactions: number;
  average: number;
  items: number;
  topProducts: TopProduct[];
  byMethod: Array<{ method: string; orders: number; sales: number }>;
  buckets: SalesBucket[];
};

/**
 * Revenue = total of orders paid inside [from, to). Hourly buckets for a single day, daily otherwise.
 * Unpaid and refunded orders never count as revenue.
 */
export function summarizeSales(orders: OrderRow[], from: number, to: number): SalesSummary {
  const paid = orders
    .filter((o) => isPaid(o) && o.paidAt !== undefined && o.paidAt >= from && o.paidAt < to)
    .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));
  const revenue = paid.reduce((sum, o) => sum + o.total, 0);
  const items = paid.reduce((sum, o) => sum + o.itemCount, 0);

  const products = new Map<string, TopProduct>();
  for (const o of paid) {
    for (const line of o.items ?? []) {
      const entry = products.get(line.name) ?? { name: line.name, qty: 0, sales: 0 };
      entry.qty += line.qty;
      entry.sales += line.price * line.qty;
      products.set(line.name, entry);
    }
  }

  const methods = new Map<string, { method: string; orders: number; sales: number }>();
  for (const o of paid) {
    const method = o.method ? PAY_METHOD_LABEL[o.method] : "Lainnya";
    const entry = methods.get(method) ?? { method, orders: 0, sales: 0 };
    entry.orders += 1;
    entry.sales += o.total;
    methods.set(method, entry);
  }

  const hourly = to - from <= 24 * 60 * 60 * 1000;
  const buckets = new Map<string, SalesBucket>();
  if (hourly) {
    for (let h = 0; h < 24; h++) {
      const key = String(h).padStart(2, "0");
      buckets.set(key, { key, label: `${key}:00`, orders: 0, items: 0, sales: 0 });
    }
  } else {
    for (let day = new Date(from); day.getTime() < to; day.setDate(day.getDate() + 1)) {
      const key = localDayKey(day.getTime());
      const label = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(day);
      buckets.set(key, { key, label, orders: 0, items: 0, sales: 0 });
    }
  }
  for (const o of paid) {
    const key = hourly ? String(new Date(o.paidAt!).getHours()).padStart(2, "0") : localDayKey(o.paidAt!);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.items += o.itemCount;
    bucket.sales += o.total;
  }

  return {
    paid,
    revenue,
    transactions: paid.length,
    average: paid.length > 0 ? Math.round(revenue / paid.length) : 0,
    items,
    topProducts: [...products.values()].sort((a, b) => b.qty - a.qty || b.sales - a.sales),
    byMethod: [...methods.values()].sort((a, b) => b.sales - a.sales),
    buckets: [...buckets.values()],
  };
}

function formatDateTime(ts?: number): string {
  return ts ? new Date(ts).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "";
}

function transactionRows(orders: OrderRow[]): Array<Array<string | number>> {
  return orders.map((o) => [
    o.no,
    formatDateTime(o.createdAt),
    formatDateTime(o.paidAt),
    tableLabel(o),
    o.customerName ?? "",
    o.source ?? "",
    o.method ? PAY_METHOD_LABEL[o.method] : "",
    o.paidBy ?? "",
    o.itemCount,
    o.subtotal ?? "",
    o.discount ?? 0,
    o.serviceCharge ?? 0,
    o.tax ?? 0,
    o.total,
    (o.items ?? []).map((i) => `${i.qty}x ${i.name}${i.note ? ` (${i.note})` : ""}`).join(" | "),
  ]);
}

const TRANSACTION_HEADERS = [
  "No",
  "Dibuat",
  "Dibayar",
  "Meja",
  "Pelanggan",
  "Sumber",
  "Metode",
  "Kasir",
  "Jumlah item",
  "Subtotal",
  "Diskon",
  "Service",
  "Pajak",
  "Total",
  "Rincian",
];

export function exportTransactionsCsv(summary: SalesSummary, periodSlug: string): void {
  const csv = toCsv(TRANSACTION_HEADERS, transactionRows(summary.paid));
  download(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), `wakro-transaksi-${periodSlug}.csv`);
}

export async function exportReportExcel(summary: SalesSummary, periodLabel: string, periodSlug: string): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [`Laporan Penjualan ${STORE_PROFILE.brand}`],
      ["Periode", periodLabel],
      ["Total omset", summary.revenue],
      ["Jumlah transaksi", summary.transactions],
      ["Rata-rata transaksi", summary.average],
      ["Item terjual", summary.items],
      [],
      ["Metode", "Transaksi", "Omset"],
      ...summary.byMethod.map((m) => [m.method, m.orders, m.sales]),
    ]),
    "Ringkasan",
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([TRANSACTION_HEADERS, ...transactionRows(summary.paid)]), "Transaksi");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Produk", "Qty", "Penjualan"], ...summary.topProducts.map((p) => [p.name, p.qty, p.sales])]),
    "Produk Terlaris",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Periode", "Transaksi", "Item", "Omset"],
      ...summary.buckets.map((b) => [b.label, b.orders, b.items, b.sales]),
    ]),
    "Grafik",
  );
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `wakro-laporan-${periodSlug}.xlsx`,
  );
}
