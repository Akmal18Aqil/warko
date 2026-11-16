import QRCode from "qrcode";
import type { TableRow } from "./db";
import { getNetworkHostInfo } from "../services/localSyncServer";

/** Customer self-order URL for a table; the stable table id survives renames. */
export function tableOrderUrl(table: Pick<TableRow, "id">): string {
  return `${getNetworkHostInfo().baseUrl}/order/${encodeURIComponent(table.id)}`;
}

export function tableQrDataUrl(table: Pick<TableRow, "id">, width = 320): Promise<string> {
  return QRCode.toDataURL(tableOrderUrl(table), {
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
        <p class="brand">WAKRO Digital · Warung WakRo Baru</p>
        <img src="${qr}" alt="QR ${escapeHtml(table.name)}" />
        <figcaption><strong>${escapeHtml(table.name)}</strong><span>${escapeHtml(table.area)}</span></figcaption>
        <p class="hint">Scan untuk lihat menu, pesan &amp; bayar</p>
      </figure>`;
    }),
  );
  win.document.open();
  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8" /><title>QR Meja WAKRO</title>
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
    <script>window.onload = () => { window.focus(); window.print(); };<\/script></body></html>`);
  win.document.close();
}
