import type { CategoryRow, TableRow } from "../types/domain";

/** Static catalog of the browser-only (local) demo mode. The remote data source never uses it. */

export const DEFAULT_CATEGORIES: CategoryRow[] = [
  { id: "cat-favorit", name: "Favorit", kind: "Makanan", color: "accent", sortOrder: 1, isDefault: true, createdAt: 1700000000000 },
  { id: "cat-sarapan", name: "Sarapan", kind: "Makanan", color: "amber", sortOrder: 2, isDefault: true, createdAt: 1700000001000 },
  { id: "cat-makanan", name: "Makanan", kind: "Makanan", color: "rose", sortOrder: 3, isDefault: true, createdAt: 1700000002000 },
  { id: "cat-mie", name: "Mie & Pasta", kind: "Makanan", color: "purple", sortOrder: 4, isDefault: true, createdAt: 1700000003000 },
  { id: "cat-minuman", name: "Minuman", kind: "Minuman", color: "blue", sortOrder: 5, isDefault: true, createdAt: 1700000004000 },
  { id: "cat-camilan", name: "Camilan", kind: "Camilan", color: "emerald", sortOrder: 6, isDefault: true, createdAt: 1700000005000 },
  { id: "cat-dessert", name: "Dessert", kind: "Camilan", color: "teal", sortOrder: 7, isDefault: true, createdAt: 1700000006000 },
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
