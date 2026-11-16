import { dataSource } from "../data";
import type { MenuItem } from "../data/menu";
import { loadPublicMenu } from "../data/public";
import { resetToDemoSeed } from "../data/backup";
import { broadcastSync } from "../lib/syncBus";
import type { CategoryRow, TableRow } from "../types/domain";
import { catalogStore, sessionStore } from "./stores";
import { useStore } from "./store";

export const useProducts = () => useStore(catalogStore, (s) => s.products);
export const useCategories = () => useStore(catalogStore, (s) => s.categories);
export const useTables = () => useStore(catalogStore, (s) => s.tables);

// ---- refresh (read-only: never broadcast, so tab sync cannot echo) ------------------------

export async function refreshProducts(): Promise<void> {
  const products = sessionStore.get().publicCustomer ? (await loadPublicMenu()).products : await dataSource.loadProducts();
  catalogStore.set({ products });
}

export async function refreshTables(): Promise<void> {
  catalogStore.set({ tables: await dataSource.loadTables() });
}

export async function refreshCategories(): Promise<void> {
  catalogStore.set({ categories: await dataSource.loadCategories() });
}

/** Re-reads products after an order so stock badges (HABIS / low stock) are current. */
export async function refreshProductsAfterOrder(): Promise<void> {
  try {
    await refreshProducts();
    if (!sessionStore.get().publicCustomer) broadcastSync({ type: "PRODUCTS_UPDATED" });
  } catch (error) {
    console.warn("Gagal memuat ulang stok produk:", error);
  }
}

// ---- products -------------------------------------------------------------------------------

export async function saveProduct(item: MenuItem): Promise<void> {
  await dataSource.saveProduct(item);
  await refreshProducts();
  broadcastSync({ type: "PRODUCTS_UPDATED" });
}

export async function deleteProduct(id: string): Promise<void> {
  await dataSource.deleteProduct(id);
  await refreshProducts();
  broadcastSync({ type: "PRODUCTS_UPDATED" });
}

export async function adjustStock(item: MenuItem, mode: "set" | "add", qty: number | null): Promise<void> {
  const updated = await dataSource.adjustStock(item, mode, qty);
  catalogStore.set((s) => ({
    products: s.products.map((p) => (p.id === item.id ? { ...p, stock: updated.stock } : p)),
  }));
  broadcastSync({ type: "PRODUCTS_UPDATED" });
}

// ---- categories -----------------------------------------------------------------------------

export async function addCategory(input: Partial<CategoryRow>): Promise<CategoryRow> {
  const category: CategoryRow = {
    id: input.id || `cat-${Date.now()}`,
    name: input.name?.trim() || "Kategori Baru",
    kind: input.kind || "Makanan",
    color: input.color || "accent",
    sortOrder: input.sortOrder ?? catalogStore.get().categories.length + 1,
    createdAt: Date.now(),
    isDefault: false,
  };
  await dataSource.saveCategory(category);
  await refreshCategories();
  broadcastSync({ type: "CATEGORIES_UPDATED" });
  return category;
}

export async function updateCategory(id: string, updates: Partial<CategoryRow>, oldName?: string): Promise<void> {
  await dataSource.updateCategory(id, updates, oldName);
  // A rename also renames the category on every product.
  await Promise.all([refreshCategories(), refreshProducts()]);
  broadcastSync({ type: "CATEGORIES_UPDATED" });
}

export async function deleteCategory(id: string, categoryName: string, reassignToCategoryName?: string): Promise<void> {
  await dataSource.deleteCategory(id, categoryName, reassignToCategoryName);
  await Promise.all([refreshCategories(), refreshProducts()]);
  broadcastSync({ type: "CATEGORIES_UPDATED" });
}

// ---- tables ---------------------------------------------------------------------------------

export async function saveTable(table: TableRow): Promise<void> {
  await dataSource.saveTable(table);
  await refreshTables();
  broadcastSync({ type: "TABLE_UPDATED" });
}

export async function deleteTable(id: string): Promise<void> {
  await dataSource.deleteTable(id);
  await refreshTables();
  broadcastSync({ type: "TABLE_UPDATED" });
}

// ---- local demo data --------------------------------------------------------------------------

/** Restores the demo menu, tables and categories in the browser database (local mode only). */
export async function resetCatalogToDemo(): Promise<void> {
  await resetToDemoSeed();
  await Promise.all([refreshProducts(), refreshTables(), refreshCategories()]);
  broadcastSync({ type: "PRODUCTS_UPDATED" });
  broadcastSync({ type: "TABLE_UPDATED" });
  broadcastSync({ type: "CATEGORIES_UPDATED" });
}
