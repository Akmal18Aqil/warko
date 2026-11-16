import { describe, expect, it } from "vitest";
import { migrateLegacyStorage, STORAGE_KEYS } from "./storageKeys";

function memoryStorage(initial: Record<string, string>): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("migrateLegacyStorage", () => {
  it("moves the staff list and server IP to the wakro_ keys", () => {
    const storage = memoryStorage({ kasa_staff_list_v1: "[1]", kasa_custom_server_ip: "192.168.1.9" });
    migrateLegacyStorage(storage);
    expect(storage.getItem(STORAGE_KEYS.staffList)).toBe("[1]");
    expect(storage.getItem(STORAGE_KEYS.customServerIp)).toBe("192.168.1.9");
    expect(storage.getItem("kasa_staff_list_v1")).toBeNull();
  });

  it("folds the four pricing keys into one JSON object", () => {
    const storage = memoryStorage({
      kasa_tax_enabled: "0",
      kasa_tax_rate: "10",
      kasa_service_charge_enabled: "1",
      kasa_service_charge_rate: "7.5",
    });
    migrateLegacyStorage(storage);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.pricing) ?? "null")).toEqual({
      taxEnabled: false,
      taxRate: 10,
      serviceChargeEnabled: true,
      serviceChargeRate: 7.5,
    });
    expect(storage.getItem("kasa_tax_rate")).toBeNull();
  });

  it("never overwrites a value already stored under the new key", () => {
    const storage = memoryStorage({ kasa_staff_list_v1: "old", wakro_staff_list_v1: "new" });
    migrateLegacyStorage(storage);
    expect(storage.getItem(STORAGE_KEYS.staffList)).toBe("new");
  });

  it("does not carry over transient keys", () => {
    const storage = memoryStorage({ kasa_printer_driver: "browser", "kasa-sidebar-collapsed": "1" });
    migrateLegacyStorage(storage);
    expect(storage.getItem(STORAGE_KEYS.printerDriver)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBeNull();
  });
});
