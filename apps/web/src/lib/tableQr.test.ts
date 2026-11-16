import { describe, expect, it } from "vitest";
import type { TableRow } from "../types/domain";
import { parseTableQr, resolveTable, tableOrderUrl } from "./tableQr";

const tables: TableRow[] = [
  { id: "meja-01", name: "Meja 01", seats: 2, area: "Lantai 1" },
  { id: "t-ab12", name: "Teras Kiri", seats: 4, area: "Lantai 1" },
  { id: "rooftop-01", name: "Rooftop 01", seats: 4, area: "Rooftop" },
];

describe("parseTableQr", () => {
  it("reads absolute and relative order URLs", () => {
    expect(parseTableQr("http://192.168.1.5:5173/order/meja-01")).toBe("meja-01");
    expect(parseTableQr("/order/t-ab12?x=1")).toBe("t-ab12");
  });

  it("decodes percent-escaped ids and survives malformed escapes", () => {
    expect(parseTableQr("https://x.id/order/Teras%20Kiri")).toBe("Teras Kiri");
    expect(parseTableQr("https://x.id/order/bad%E0%A4%A")).toBe("bad%E0%A4%A");
  });

  it("accepts bare table codes", () => {
    expect(parseTableQr("meja-01")).toBe("meja-01");
    expect(parseTableQr(" Meja 01 ")).toBe("meja-01");
    expect(parseTableQr("MEJA01")).toBe("meja-01");
    expect(parseTableQr("rooftop 2")).toBe("rooftop-2");
  });

  it("rejects product barcodes and unrelated text", () => {
    expect(parseTableQr("8991002100015")).toBeNull();
    expect(parseTableQr("kopi susu")).toBeNull();
    expect(parseTableQr("")).toBeNull();
  });
});

describe("resolveTable", () => {
  it("matches by id, then case-insensitive id, then name slug", () => {
    expect(resolveTable(tables, "t-ab12")?.id).toBe("t-ab12");
    expect(resolveTable(tables, "T-AB12")?.id).toBe("t-ab12");
    expect(resolveTable(tables, "teras-kiri")?.id).toBe("t-ab12");
  });

  it("never guesses a partial match", () => {
    expect(resolveTable(tables, "meja")).toBeUndefined();
    expect(resolveTable(tables, "01")).toBeUndefined();
    expect(resolveTable(tables, "meja-1")).toBeUndefined();
  });

  it("returns undefined without a key", () => {
    expect(resolveTable(tables, null)).toBeUndefined();
    expect(resolveTable(tables, "")).toBeUndefined();
  });
});

describe("tableOrderUrl", () => {
  it("encodes the id under the given base", () => {
    expect(tableOrderUrl({ id: "Teras Kiri" }, "http://10.0.0.2:5173")).toBe("http://10.0.0.2:5173/order/Teras%20Kiri");
  });
});
