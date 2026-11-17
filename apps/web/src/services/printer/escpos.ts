import { STORE_PROFILE } from "../../lib/storeProfile";
import { LINE_CHARS, type PaperWidth } from "./paper";
import type { ReceiptPayload } from "./types";

/**
 * Standard ESC/POS Command Byte Sequences
 */
export const ESC_POS_COMMANDS = {
  INIT: [0x1b, 0x40], // ESC @
  ALIGN_LEFT: [0x1b, 0x61, 0x00], // ESC a 0
  ALIGN_CENTER: [0x1b, 0x61, 0x01], // ESC a 1
  ALIGN_RIGHT: [0x1b, 0x61, 0x02], // ESC a 2
  BOLD_ON: [0x1b, 0x45, 0x01], // ESC E 1
  BOLD_OFF: [0x1b, 0x45, 0x00], // ESC E 0
  DOUBLE_SIZE: [0x1d, 0x21, 0x11], // GS ! 17
  NORMAL_SIZE: [0x1d, 0x21, 0x00], // GS ! 0
  FEED_LINES: (n: number) => [0x1b, 0x64, n], // ESC d n
  PARTIAL_CUT: [0x1d, 0x56, 0x01], // GS V 1
  FULL_CUT: [0x1d, 0x56, 0x00], // GS V 0
  DRAWER_KICK: [0x1b, 0x70, 0x00, 0x19, 0xfa], // ESC p 0 25 250
};

/** Splits `text` into lines of at most `width` characters, breaking at spaces where possible. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word;
    while (rest.length > width) {
      if (line) lines.push(line);
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
      line = "";
    }
    if (!line) line = rest;
    else if (line.length + 1 + rest.length <= width) line = `${line} ${rest}`;
    else {
      lines.push(line);
      line = rest;
    }
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

/**
 * Left text and right-aligned amount. A left side too long for one line wraps instead of being cut,
 * so long menu names and their notes stay readable; the amount goes on its own line if it no longer fits.
 */
export function formatTwoColumns(left: string, right: string, maxChars: number): string {
  const lines = wrap(left, maxChars);
  const last = lines[lines.length - 1];
  if (last.length + 1 + right.length <= maxChars) {
    lines[lines.length - 1] = `${last}${" ".repeat(maxChars - last.length - right.length)}${right}`;
  } else {
    lines.push(right.padStart(maxChars));
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Thermal printers decode text in a single-byte code page (usually PC437), not UTF-8, so every byte
 * sent must be ASCII: accents are dropped (é → e), the no-break space `Intl` puts after "Rp" becomes
 * a space, "·" and dashes become "-", and anything else becomes "?". Replacements are one character
 * each, so the column layout computed before conversion still lines up.
 */
export function toPrinterText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u00b7\u2022\u2013\u2014]/g, "-")
    .replace(/\u00d7/g, "x")
    .replace(/[^\n\x20-\x7e]/g, "?");
}

/**
 * Generate ESC/POS Binary Buffer from ReceiptPayload
 */
export function generateEscPosReceipt(payload: ReceiptPayload, paperWidth: PaperWidth): Uint8Array {
  const maxChars = LINE_CHARS[paperWidth];
  const bytes: number[] = [];

  const append = (arr: number[]) => bytes.push(...arr);
  const appendText = (text: string) => {
    for (const char of toPrinterText(text)) bytes.push(char.charCodeAt(0));
  };

  // 1. Initialize Printer
  append(ESC_POS_COMMANDS.INIT);

  // 2. Header (Store Title)
  append(ESC_POS_COMMANDS.ALIGN_CENTER);
  append(ESC_POS_COMMANDS.BOLD_ON);
  append(ESC_POS_COMMANDS.DOUBLE_SIZE);
  appendText(`${STORE_PROFILE.brand.toUpperCase()}\n`);
  append(ESC_POS_COMMANDS.NORMAL_SIZE);
  appendText(`${STORE_PROFILE.outlet}\n`);
  appendText(`${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}\n`);
  append(ESC_POS_COMMANDS.BOLD_OFF);

  // 3. Divider
  appendText(`${"-".repeat(maxChars)}\n`);

  // 4. Order Info
  append(ESC_POS_COMMANDS.ALIGN_LEFT);
  if (payload.orderNo > 0) {
    appendText(`No. Pesanan: #${payload.orderNo}\n`);
    for (const line of payload.details ?? []) appendText(`${line}\n`);
  } else {
    appendText("UJI COBA CETAK STRUK\n");
  }
  appendText(`${"-".repeat(maxChars)}\n`);

  // 5. Item Lines
  if (payload.lines.length === 0) {
    appendText("Koneksi Printer Bluetooth OK\n");
  } else {
    for (const item of payload.lines) {
      const itemTitle = `${item.qty}x ${item.name}`;
      appendText(formatTwoColumns(itemTitle, item.amount, maxChars));
    }
  }

  // 6. Divider & Total
  appendText(`${"-".repeat(maxChars)}\n`);
  for (const row of payload.summary ?? []) appendText(formatTwoColumns(row.label, row.amount, maxChars));
  if (payload.total) {
    append(ESC_POS_COMMANDS.BOLD_ON);
    appendText(formatTwoColumns("TOTAL", payload.total, maxChars));
    append(ESC_POS_COMMANDS.BOLD_OFF);
  }
  for (const row of payload.payment ?? []) appendText(formatTwoColumns(row.label, row.amount, maxChars));

  // 7. Footer
  append(ESC_POS_COMMANDS.ALIGN_CENTER);
  appendText("\nTerima Kasih Atas Kunjungan Anda!\n");
  appendText("Simpan struk sebagai bukti pembayaran\n");

  // 8. Feed & Cut
  append(ESC_POS_COMMANDS.FEED_LINES(4));
  append(ESC_POS_COMMANDS.PARTIAL_CUT);

  return new Uint8Array(bytes);
}
