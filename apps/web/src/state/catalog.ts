import { dataSource } from "../data/index";
import type { MenuItem } from "../data/menu";
import { loadPublicMenu } from "../data/public";
import { broadcastSync } from "../lib/syncBus";
import { t } from "../locales/id";
import type { CategoryRow, TableRow } from "../types/domain";
import { useStore } from "./store";
import { catalogStore, sessionStore } from "./stores";

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
    name: input.name?.trim() || t.state.newCategoryName,
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
