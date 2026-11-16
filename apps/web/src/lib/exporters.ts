import * as XLSX from "xlsx";
import { db, tablesTable, DEFAULT_TABLES, type OrderRow, type TableRow } from "./db";
import { MENU_SEED, type MenuItem } from "../data/menu";
import { isPaid, tableLabel } from "./orderStatus";
import { PAY_METHOD_LABEL } from "./receipt";

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
  return [headers.map(csvEscape).join(";"), ...rows.map((r) => r.map(csvEscape).join(";"))].join(
    "\r\n",
  );
}

export async function exportBackupJson(): Promise<void> {
  const [products, orders, tables, shifts] = await Promise.all([
    db.products.toArray(),
    db.orders.toArray(),
    tablesTable.toArray(),
    db.shifts.toArray(),
  ]);

  const payload = {
    app: "WAKRO Digital",
    version: 3,
    exportedAt: new Date().toISOString(),
    products,
    orders,
    tables,
    shifts,
  };

  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `wakro-cadangan-lengkap-${dateStamp()}.json`,
  );
}

export async function exportProductsCsv(products: MenuItem[]): Promise<void> {
  const csv = toCsv(
    ["id", "barcode", "nama", "deskripsi", "harga", "kategori", "jenis", "menit", "stok"],
    products.map((p) => [
      p.id,
      p.barcode,
      p.name,
      p.description,
      p.price,
      p.category,
      p.kind,
      p.prepMinutes,
      p.stock ?? "",
    ]),
  );
  download(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    `wakro-produk-${dateStamp()}.csv`,
  );
}

export type ImportResult = {
  products: number;
  orders: number;
  tables: number;
};

export async function importBackupFile(file: File): Promise<ImportResult> {
  const isJson = file.name.endsWith(".json");
  const isCsv = file.name.endsWith(".csv");

  if (!isJson && !isCsv) {
    throw new Error("Format berkas tidak didukung. Harap unggah file .json atau .csv.");
  }

  const text = await file.text();

  if (isJson) {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gagal membaca file JSON. Berkas mungkin rusak atau tidak valid.");
    }

    let productsToInsert: MenuItem[] = [];
    let ordersToInsert: OrderRow[] = [];
    let tablesToInsert: TableRow[] = [];

    // Case 1: Full backup object
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.products)) {
        productsToInsert = parsed.products;
      }
      if (Array.isArray(parsed.orders)) {
        ordersToInsert = parsed.orders;
      }
      if (Array.isArray(parsed.tables)) {
        tablesToInsert = parsed.tables;
      }
    }
    // Case 2: Array of products directly
    else if (Array.isArray(parsed)) {
      productsToInsert = parsed;
    }

    const validProducts = productsToInsert.filter(
      (p) => p && typeof p.id === "string" && typeof p.name === "string" && typeof p.price === "number",
    );

    const validOrders = ordersToInsert.filter(
      (o) => o && typeof o.no === "number" && typeof o.total === "number",
    );

    const validTables = tablesToInsert.filter(
      (t) => t && typeof t.id === "string" && typeof t.name === "string",
    );

    if (validProducts.length === 0 && validOrders.length === 0 && validTables.length === 0) {
      throw new Error("Tidak ada data produk, pesanan, atau meja yang valid dalam berkas ini.");
    }

    if (validProducts.length > 0) {
      await db.products.bulkPut(validProducts);
    }
    if (validOrders.length > 0) {
      await db.orders.bulkPut(validOrders);
    }
    if (validTables.length > 0) {
      await tablesTable.bulkPut(validTables);
    }

    return {
      products: validProducts.length,
      orders: validOrders.length,
      tables: validTables.length,
    };
  }

  // Handle CSV Products Import
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    throw new Error("File CSV kosong atau tidak memiliki baris data produk.");
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const rows = lines.slice(1).map((line) => line.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim()));

  const importedProducts: MenuItem[] = rows
    .filter((r) => r.length >= 3 && r[1])
    .map((r, index) => {
      const id = r[0] || `item-csv-${Date.now()}-${index}`;
      const barcode = r[1] || `899${Date.now().toString().slice(-9)}${index}`;
      const name = r[2] || "Produk Impor";
      const description = r[3] || "Deskripsi produk";
      const price = Number.parseInt((r[4] || "0").replace(/\D/g, ""), 10) || 10000;
      const category = (r[5] as any) || "Makanan";
      const kind = (r[6] as any) || "Makanan";
      const prepMinutes = Number.parseInt(r[7] || "5", 10) || 5;

      return {
        id,
        barcode,
        name,
        description,
        price,
        category,
        kind,
        prepMinutes,
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&q=70",
      };
    });

  if (importedProducts.length === 0) {
    throw new Error("Tidak ada baris data produk yang valid dalam file CSV.");
  }

  await db.products.bulkPut(importedProducts);
  return {
    products: importedProducts.length,
    orders: 0,
    tables: 0,
  };
}

export async function resetToDemoSeed(): Promise<{ products: number; tables: number }> {
  await db.products.clear();
  await db.products.bulkPut(MENU_SEED);
  await tablesTable.bulkPut(DEFAULT_TABLES);
  return {
    products: MENU_SEED.length,
    tables: DEFAULT_TABLES.length,
  };
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
  download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `wakro-transaksi-${periodSlug}.csv`);
}

export function exportReportExcel(summary: SalesSummary, periodLabel: string, periodSlug: string): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Laporan Penjualan WAKRO Digital"],
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
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([TRANSACTION_HEADERS, ...transactionRows(summary.paid)]),
    "Transaksi",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Produk", "Qty", "Penjualan"], ...summary.topProducts.map((p) => [p.name, p.qty, p.sales])]),
    "Produk Terlaris",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Periode", "Transaksi", "Item", "Omset"], ...summary.buckets.map((b) => [b.label, b.orders, b.items, b.sales])]),
    "Grafik",
  );
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `wakro-laporan-${periodSlug}.xlsx`,
  );
}
