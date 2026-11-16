import type { CashMovementRow, CategoryRow, OrderRow, TableRow } from "../types/domain";

/** Demo data for the browser-only (local) mode. The remote data source never uses it. */

export const DEFAULT_CATEGORIES: CategoryRow[] = [
  { id: "cat-favorit", name: "Favorit", kind: "Makanan", color: "accent", sortOrder: 1, isDefault: true, createdAt: 1700000000000 },
  { id: "cat-sarapan", name: "Sarapan", kind: "Makanan", color: "amber", sortOrder: 2, isDefault: true, createdAt: 1700000001000 },
  { id: "cat-makanan", name: "Makanan", kind: "Makanan", color: "rose", sortOrder: 3, isDefault: true, createdAt: 1700000002000 },
  { id: "cat-minuman", name: "Minuman", kind: "Minuman", color: "blue", sortOrder: 4, isDefault: true, createdAt: 1700000003000 },
  { id: "cat-camilan", name: "Camilan", kind: "Camilan", color: "emerald", sortOrder: 5, isDefault: true, createdAt: 1700000004000 },
];

export const DEFAULT_FLOORS = ["Lantai 1", "Lantai 2", "Rooftop"] as const;

export const DEFAULT_TABLES: TableRow[] = [
  { id: "meja-01", name: "Meja 01", seats: 2, area: "Lantai 1" },
  { id: "meja-02", name: "Meja 02", seats: 4, area: "Lantai 1" },
  { id: "meja-03", name: "Meja 03", seats: 4, area: "Lantai 1" },
  { id: "meja-04", name: "Meja 04", seats: 4, area: "Lantai 1" },
  { id: "meja-05", name: "Meja 05", seats: 4, area: "Lantai 2" },
  { id: "meja-06", name: "Meja 06", seats: 6, area: "Lantai 2" },
  { id: "meja-07", name: "Meja 07", seats: 4, area: "Lantai 2" },
  { id: "rooftop-01", name: "Rooftop 01", seats: 4, area: "Rooftop" },
  { id: "rooftop-02", name: "Rooftop 02", seats: 6, area: "Rooftop" },
];

export function demoOrders(now: number): OrderRow[] {
  return [
    {
      no: 1048,
      status: "memasak",
      paymentStatus: "unpaid",
      kitchenStatus: "preparing",
      total: 85000,
      subtotal: 76500,
      tax: 8500,
      discount: 0,
      itemCount: 3,
      orderType: "meja",
      tableId: "meja-01",
      tableName: "Meja 01",
      tableArea: "Lantai 1",
      customerName: "Budi Santoso",
      source: "self-order",
      paymentChoice: "pay-later",
      guests: 2,
      items: [
        { itemId: "kopi-susu", name: "Kopi Susu", qty: 2, price: 25000, note: "Less ice, gula aren terpisah" },
        { itemId: "roti-panggang-isi", name: "Roti Panggang Isi", qty: 1, price: 26500, note: "Ekstra keju" },
      ],
      createdAt: now - 600_000,
    },
    {
      no: 1047,
      status: "siap",
      paymentStatus: "unpaid",
      kitchenStatus: "ready",
      total: 284000,
      subtotal: 255855,
      tax: 28145,
      discount: 0,
      itemCount: 2,
      orderType: "meja",
      tableId: "meja-04",
      tableName: "Meja 04",
      tableArea: "Lantai 1",
      customerName: "Rina & Teman",
      source: "waiter",
      paymentChoice: "pay-later",
      guests: 2,
      items: [{ itemId: "nasi-goreng-spesial", name: "Nasi Goreng Spesial", qty: 2, price: 35000, note: "Pedas sedang" }],
      createdAt: now - 3600_000,
    },
    {
      no: 1046,
      status: "sudah-dibayar",
      paymentStatus: "paid",
      kitchenStatus: "served",
      total: 198000,
      itemCount: 2,
      method: "kartu-qr",
      orderType: "bawa-pulang",
      customerName: "Andi",
      source: "pos",
      paidAt: now - 5400_000,
      createdAt: now - 6000_000,
    },
    {
      no: 1045,
      status: "memasak",
      paymentStatus: "unpaid",
      kitchenStatus: "queued",
      total: 442000,
      itemCount: 5,
      orderType: "meja",
      tableId: "meja-02",
      tableName: "Meja 02",
      tableArea: "Lantai 1",
      customerName: "Pak Wijaya",
      source: "self-order",
      paymentChoice: "pay-later",
      guests: 4,
      createdAt: now - 7200_000,
    },
    {
      no: 1044,
      status: "sudah-dibayar",
      paymentStatus: "paid",
      kitchenStatus: "served",
      total: 118000,
      itemCount: 1,
      method: "tunai",
      orderType: "bawa-pulang",
      customerName: "Lia",
      source: "pos",
      paidAt: now - 9000_000,
      createdAt: now - 9600_000,
    },
  ];
}

export function demoMovements(now: number): CashMovementRow[] {
  return [
    {
      id: "mov-01",
      type: "CASH_IN",
      category: "modal_awal",
      amount: 200000,
      description: "Modal awal kasir buka shift",
      cashierName: "Kasir demo",
      createdAt: now - 14400_000,
    },
    {
      id: "mov-02",
      type: "CASH_OUT",
      category: "bahan_baku",
      amount: 25000,
      description: "Beli Es Batu Kristal 2 Pack",
      cashierName: "Kasir demo",
      createdAt: now - 7200_000,
    },
  ];
}
