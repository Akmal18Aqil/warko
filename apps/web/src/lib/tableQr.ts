import { getNetworkHostInfo } from "../services/networkHost";
import type { TableRow } from "../types/domain";
import { qrDataUrl } from "./qr";
import { STORE_PROFILE, STORE_TITLE } from "./storeProfile";

/** Customer self-order URL for a table; the stable table id survives renames. */
export function tableOrderUrl(table: Pick<TableRow, "id">, baseUrl: string = getNetworkHostInfo().baseUrl): string {
  return `${baseUrl}/order/${encodeURIComponent(table.id)}`;
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Extracts the table key from scanned or pasted QR text: an `/order/<key>` URL (absolute or
 * relative) or a bare `meja-01` / `Meja 01` code. Returns null for anything else, e.g. a product barcode.
 */
export function parseTableQr(text: string): string | null {
  const value = text.trim();
  const fromUrl = /\/order\/([A-Za-z0-9_.:%-]+)/.exec(value);
  if (fromUrl) return safeDecode(fromUrl[1]);
  const bare = /^(meja|rooftop)[ -]?(\d+)$/i.exec(value);
  return bare ? `${bare[1].toLowerCase()}-${bare[2]}` : null;
}

/**
 * Finds the table for a QR key. Stickers carry the table id; older ones carried a name slug
 * (`meja-01`). Only exact matches count: a partial match could seat guests at the wrong table.
 */
export function resolveTable(tables: readonly TableRow[], key: string | null | undefined): TableRow | undefined {
  if (!key) return undefined;
  const lower = key.toLowerCase();
  return (
    tables.find((t) => t.id === key) ??
    tables.find((t) => t.id.toLowerCase() === lower) ??
    tables.find((t) => t.name.toLowerCase().replace(/\s+/g, "-") === lower)
  );
}

export function tableQrDataUrl(table: Pick<TableRow, "id">, width = 320): Promise<string> {
  return qrDataUrl(tableOrderUrl(table), {
    width,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0B1B33", light: "#FFFFFF" },
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Opens a printable sheet of table QR stickers (one per table) in a new window. The window is
 * opened synchronously inside the click handler so popup blockers allow it.
 */
export async function printTableQrSheets(tables: TableRow[]): Promise<void> {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) throw new Error("Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini.");
  win.document.write("<p style='font-family:sans-serif'>Menyiapkan QR meja…</p>");
  const stickers = await Promise.all(
    tables.map(async (table) => {
      const qr = await tableQrDataUrl(table, 360);
      return `<figure class="sticker">
        <p class="brand">${escapeHtml(STORE_TITLE)}</p>
        <img src="${qr}" alt="QR ${escapeHtml(table.name)}" />
        <figcaption><strong>${escapeHtml(table.name)}</strong><span>${escapeHtml(table.area)}</span></figcaption>
        <p class="hint">Scan untuk lihat menu, pesan &amp; bayar</p>
      </figure>`;
    }),
  );
  win.document.open();
  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8" /><title>QR Meja ${escapeHtml(STORE_PROFILE.brand)}</title>
    <style>
      body { font-family: "Trebuchet MS", sans-serif; margin: 16px; color: #0B1B33; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
      .sticker { margin: 0; border: 2px dashed #0B1B33; border-radius: 16px; padding: 14px; text-align: center; break-inside: avoid; }
      .sticker img { width: 180px; height: 180px; }
      .brand { margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .04em; }
      figcaption { display: flex; flex-direction: column; gap: 2px; font-size: 18px; }
      figcaption span { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
      .hint { margin: 8px 0 0; font-size: 11px; }
      @media print { body { margin: 0; } }
    </style></head><body><div class="grid">${stickers.join("")}</div>
    <script>window.onload = () => { window.focus(); window.print(); };</script></body></html>`);
  win.document.close();
}
