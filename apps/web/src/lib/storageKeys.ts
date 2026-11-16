/** Every browser-storage key used by the app. All keys share the `wakro_` prefix. */
export const STORAGE_KEYS = {
  staffList: "wakro_staff_list_v1",
  currentStaffId: "wakro_current_staff_id_v1",
  pricing: "wakro_pricing_v1",
  customServerIp: "wakro_custom_server_ip",
  printerDriver: "wakro_printer_driver",
  deviceInfo: "wakro_device_info",
  syncEvent: "wakro_sync_event",
  sidebarCollapsed: "wakro_sidebar_collapsed",
  selfOrders: "wakro_self_orders_v1",
  selfTable: "wakro_self_table_v1",
  selfCustomerName: "wakro_self_customer_name",
  selfPendingOrder: "wakro_pending_self_order_v1",
} as const;

export const SYNC_CHANNEL_NAME = "wakro_sync_channel";

export const waiterCartKey = (staffId: string): string => `wakro_waiter_cart_${staffId}`;
export const waiterTableKey = (staffId: string): string => `wakro_waiter_table_${staffId}`;

/** Pre-rename keys. Only values whose loss would lose user data are carried over (see `migrateLegacyStorage`). */
const LEGACY_KEYS = {
  staffList: "kasa_staff_list_v1",
  customServerIp: "kasa_custom_server_ip",
  taxEnabled: "kasa_tax_enabled",
  taxRate: "kasa_tax_rate",
  serviceChargeEnabled: "kasa_service_charge_enabled",
  serviceChargeRate: "kasa_service_charge_rate",
} as const;

function moveKey(storage: Storage, from: string, to: string): void {
  const value = storage.getItem(from);
  if (value === null) return;
  if (storage.getItem(to) === null) storage.setItem(to, value);
  storage.removeItem(from);
}

/**
 * One-time migration from the old `kasa_*` keys. Carries over only the staff list, the pricing
 * settings (four loose keys become one JSON object) and the custom server IP: losing those would
 * lose configuration the owner typed in. Transient values (selected printer, sidebar state, drafts,
 * device id) are not migrated and simply start fresh. Safe to run on every startup.
 */
export function migrateLegacyStorage(storage: Storage = localStorage): void {
  try {
    moveKey(storage, LEGACY_KEYS.staffList, STORAGE_KEYS.staffList);
    moveKey(storage, LEGACY_KEYS.customServerIp, STORAGE_KEYS.customServerIp);

    const legacyPricing = [
      LEGACY_KEYS.taxEnabled,
      LEGACY_KEYS.taxRate,
      LEGACY_KEYS.serviceChargeEnabled,
      LEGACY_KEYS.serviceChargeRate,
    ].map((key) => storage.getItem(key));
    if (legacyPricing.some((value) => value !== null) && storage.getItem(STORAGE_KEYS.pricing) === null) {
      const [taxEnabled, taxRate, serviceChargeEnabled, serviceChargeRate] = legacyPricing;
      const partial: Record<string, boolean | number> = {};
      if (taxEnabled !== null) partial.taxEnabled = taxEnabled === "1";
      if (serviceChargeEnabled !== null) partial.serviceChargeEnabled = serviceChargeEnabled === "1";
      const parsedTax = Number.parseFloat(taxRate ?? "");
      if (Number.isFinite(parsedTax)) partial.taxRate = parsedTax;
      const parsedService = Number.parseFloat(serviceChargeRate ?? "");
      if (Number.isFinite(parsedService)) partial.serviceChargeRate = parsedService;
      storage.setItem(STORAGE_KEYS.pricing, JSON.stringify(partial));
    }
    for (const key of [
      LEGACY_KEYS.taxEnabled,
      LEGACY_KEYS.taxRate,
      LEGACY_KEYS.serviceChargeEnabled,
      LEGACY_KEYS.serviceChargeRate,
    ]) {
      storage.removeItem(key);
    }
  } catch (error) {
    console.warn("Migrasi penyimpanan lama dilewati:", error);
  }
}
