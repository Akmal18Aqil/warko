import type { PricingSettings } from "@wakro/shared";
import type { MenuItem } from "./menu";
import type {
  CashMovementRow,
  CategoryRow,
  OrderRow,
  SettleResult,
  ShiftRecord,
  Snapshot,
  TableRow,
} from "../types/domain";
import { jsonBody, request, requestAllPages, requestConditional, requestEnvelope } from "./api";
import type { DataSource } from "./source";

const POLL_INTERVAL_MS = 5000;
/** Largest page the API serves for resource lists. */
const MAX_PAGE = 500;

type Resource = "products" | "tables" | "categories" | "shifts" | "cashMovements";

const resourcePath = (resource: Resource, id: string) => `/resources/${resource}/${encodeURIComponent(id)}`;

const putResource = <T>(resource: Resource, id: string, value: unknown) =>
  request<T>(resourcePath(resource, id), { method: "PUT", ...jsonBody(value) });

const listResource = <T>(resource: Resource, params: Record<string, string> = {}) =>
  request<T[]>(`/resources/${resource}?${new URLSearchParams({ limit: String(MAX_PAGE), ...params })}`);

type BootstrapPayload = {
  products: MenuItem[];
  orders: OrderRow[];
  tables: TableRow[];
  categories: CategoryRow[];
  shifts: ShiftRecord[];
  cashMovements: CashMovementRow[];
  pricing: PricingSettings;
  cashShiftOpen: boolean;
};

function toSnapshot(payload: BootstrapPayload): Snapshot {
  const { shifts, ...rest } = payload;
  return { ...rest, activeShift: shifts.find((shift) => shift.status === "OPEN") ?? null };
}


export const remoteSource: DataSource = {
  kind: "remote",

  async init() {},

  async loadSnapshot() {
    const result = await requestConditional<BootstrapPayload>("/bootstrap", null);
    if (result.notModified) throw new Error("Respons bootstrap tidak valid.");
    return toSnapshot(result.data);
  },

  watch({ onSnapshot, onHealthy, onError }) {
    let active = true;
    let inFlight = false;
    let bootstrapEtag: string | null = null;
    const timer = window.setInterval(() => {
      if (!active || inFlight || document.hidden) return;
      inFlight = true;
      requestConditional<BootstrapPayload>("/bootstrap", bootstrapEtag)
        .then((result) => {
          if (!active) return;
          onHealthy();
          if (result.notModified) return;
          onSnapshot(toSnapshot(result.data));
          bootstrapEtag = result.etag;
        })
        .catch((error: unknown) => {
          if (active) onError(error);
        })
        .finally(() => {
          inFlight = false;
        });
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  },

  loadPricing() {
    return request<PricingSettings>("/pricing");
  },

  savePricing(pricing) {
    return request<PricingSettings>("/pricing", { method: "PUT", ...jsonBody(pricing) });
  },

  loadProducts() {
    return listResource<MenuItem>("products");
  },

  async saveProduct(item) {
    await putResource("products", item.id, item);
  },

  async deleteProduct(id) {
    await request(resourcePath("products", id), { method: "DELETE" });
  },

  adjustStock(item, mode, qty) {
    return request<MenuItem>(`/products/${encodeURIComponent(item.barcode)}/stock`, {
      method: "POST",
      ...jsonBody({ mode, qty }),
    });
  },

  async findProductByBarcode(code) {
    const product = await request<MenuItem | null>(`/products?${new URLSearchParams({ barcode: code })}`);
    return product ?? undefined;
  },

  loadTables() {
    return listResource<TableRow>("tables");
  },

  async saveTable(table) {
    await putResource("tables", table.id, table);
  },

  async deleteTable(id) {
    await request(resourcePath("tables", id), { method: "DELETE" });
  },

  loadCategories() {
    return listResource<CategoryRow>("categories");
  },

  async saveCategory(category) {
    await putResource("categories", category.id, category);
  },

  async updateCategory(id, updates) {
    const current = await request<CategoryRow>(resourcePath("categories", id));
    await putResource("categories", id, { ...current, ...updates });
  },

  async deleteCategory(id, _categoryName, reassignToCategoryName) {
    const query = reassignToCategoryName ? `?${new URLSearchParams({ reassignTo: reassignToCategoryName })}` : "";
    await request(`${resourcePath("categories", id)}${query}`, { method: "DELETE" });
  },

  loadOrders() {
    return request<OrderRow[]>("/orders");
  },

  loadOrdersInRange(from, to) {
    return requestAllPages<OrderRow>("/reports/orders", { from: String(from), to: String(to) });
  },

  saveOrder(row, options) {
    return request<OrderRow>("/orders", {
      method: "POST",
      ...jsonBody({
        kitchenStatus: row.kitchenStatus,
        orderType: row.orderType,
        tableId: row.tableId,
        tableName: row.tableName,
        guests: row.guests,
        customerName: row.customerName,
        source: row.source,
        paymentChoice: row.paymentChoice,
        discount: row.discount,
        method: row.paymentStatus === "paid" ? row.method : undefined,
        cashReceived: row.paymentStatus === "paid" && row.method === "tunai" ? options.cashReceived : undefined,
        expectedTotal: row.total,
        clientRef: options.clientRef,
        items: (row.items ?? []).map((item) => ({ barcode: item.itemId, qty: item.qty, note: item.note })),
      }),
    });
  },

  async settleOrder(no, method, _paidBy, cashReceived): Promise<SettleResult> {
    const envelope = await requestEnvelope<OrderRow>(`/orders/${no}/payment`, {
      method: "POST",
      ...jsonBody({ method, cashReceived }),
    });
    return { order: envelope.data, alreadyPaid: envelope.alreadyPaid === true };
  },

  updateKitchenStatus(no, kitchenStatus) {
    return request<OrderRow>(`/orders/${no}/status`, { method: "PATCH", ...jsonBody({ kitchenStatus }) });
  },

  async loadActiveShift() {
    const [open] = await listResource<ShiftRecord>("shifts", { status: "OPEN" });
    return open;
  },

  loadShiftHistory() {
    return requestAllPages<ShiftRecord>("/resources/shifts", { limit: String(MAX_PAGE) });
  },

  saveShift(shift) {
    // The server owns cashier name and, on close, every reconciliation total.
    return putResource<ShiftRecord>("shifts", shift.id, {
      id: shift.id,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      startingCash: shift.startingCash,
      actualCash: shift.actualCash,
      denominations: shift.denominations,
      status: shift.status,
      notes: shift.notes,
    });
  },

  async loadCashMovements(shiftId) {
    const rows = await requestAllPages<CashMovementRow>("/resources/cashMovements", { limit: String(MAX_PAGE) });
    return shiftId ? rows.filter((row) => row.shiftId === shiftId) : rows;
  },

  saveCashMovement(item) {
    // The server records the signed-in staff member as the cashier.
    return putResource<CashMovementRow>("cashMovements", item.id, {
      id: item.id,
      shiftId: item.shiftId,
      type: item.type,
      category: item.category,
      amount: item.amount,
      description: item.description,
      createdAt: item.createdAt,
    });
  },

  async deleteCashMovement(id) {
    await request(resourcePath("cashMovements", id), { method: "DELETE" });
  },
};
