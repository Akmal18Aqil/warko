import { describe, expect, it } from "vitest";
import { formatIDR } from "../../data/menu";
import { generateEscPosReceipt } from "./escpos";
import { LINE_CHARS, PAPER_WIDTHS } from "./paper";
import type { ReceiptPayload } from "./types";

const payload: ReceiptPayload = {
  orderNo: 123,
  total: formatIDR(61050),
  details: ["Meja 4 · Lantai 2", "Pelanggan: Renée"],
  lines: [
    { qty: 2, name: "Nasi Goreng WakRo Spesial Pedas Level Lima (tanpa bawang, telur setengah matang)", amount: formatIDR(50000) },
    { qty: 1, name: "Es Teh Manis", amount: formatIDR(5000) },
  ],
  summary: [{ label: "Pajak", amount: formatIDR(6050) }],
  payment: [{ label: "Kembalian", amount: formatIDR(38950) }],
};

/** Printable text of an ESC/POS buffer: command bytes (< 0x20) dropped, line feeds kept. */
function textLines(bytes: Uint8Array): string[] {
  return String.fromCharCode(...bytes.filter((b) => b === 0x0a || b >= 0x20)).split("\n");
}

describe("generateEscPosReceipt", () => {
  it("sends only ASCII, so single-byte printer code pages print Rupiah amounts and separators correctly", () => {
    const bytes = generateEscPosReceipt(payload, 58);
    expect([...bytes].filter((b) => b > 0x7e)).toEqual([]);
    const text = textLines(bytes).join("\n");
    expect(text).toContain("Rp 50.000");
    expect(text).toContain("Meja 4 - Lantai 2");
    expect(text).toContain("Pelanggan: Renee");
  });

  for (const width of PAPER_WIDTHS) {
    it(`keeps item lines within ${LINE_CHARS[width]} columns on ${width} mm paper without dropping the name or note`, () => {
      const lines = textLines(generateEscPosReceipt(payload, width));
      const itemStart = lines.findIndex((l) => l.startsWith("2x "));
      const itemEnd = lines.findIndex((l, i) => i > itemStart && l.endsWith("Rp 50.000"));
      const item = lines.slice(itemStart, itemEnd + 1);
      for (const line of item) expect(line.length).toBeLessThanOrEqual(LINE_CHARS[width]);
      expect(item.join(" ").replace(/\s+/g, " ")).toContain(
        "Nasi Goreng WakRo Spesial Pedas Level Lima (tanpa bawang, telur setengah matang)",
      );
      expect(lines).toContain(`1x Es Teh Manis${" ".repeat(LINE_CHARS[width] - 15 - 8)}Rp 5.000`);
    });
  }
});
