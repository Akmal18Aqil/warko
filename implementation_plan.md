# Implementation Plan

> **Status: ✅ SELESAI DIIMPLEMENTASIKAN** — UI/UX remake bertahap selesai; `tsc --noEmit` dan `vite build` lolos. Verifikasi browser desktop/mobile juga lolos tanpa horizontal overflow pada POS utama.
> Brand tampilan tetap **KASA**; implementasi ini tidak melakukan rename brand atau identifier data.

## Overview

Remake UI/UX aplikasi POS dengan mempertahankan fitur, data, offline-first, multi-device LAN, scanner, dan printer yang sudah ada. Perubahan utama: design token biru/navy, komponen UI reusable, layout desktop/mobile, dan penyelarasan halaman operasional.

**Konteks teknis yang sudah ada:**
- Tailwind CSS v4 — seluruh warna terdefinisi di `@theme` dalam `client/src/index.css` (baris 3-11), satu-satunya sumber kebenaran warna.
- Brand "KASA" tersebar di: `client/index.html`, `client/src/locales/en.ts`, `client/src/components/KasaLogo.tsx` (logo SVG inline), `Sidebar.tsx`, `FocusModeHeader.tsx`, `PrintLayer.tsx`, `CashDrawer.tsx`, `CustomerSelfOrder.tsx`, `PaymentModal.tsx`, `QueueDisplay.tsx`, `client/src/lib/exporters.ts`, `client/public/favicon.svg`, `README.md`, `capacitor/`.
- **Perhatian data tersimpan:** `CATEGORY_COLORS` di `CategoryManagerModal.tsx:28` memakai id `"counterlime"` yang dipersist ke IndexedDB sebagai `category.color`, dan `PosContext.tsx:837` bawaan `color: input.color || "counterlime"`. Staff list di `AuthContext.tsx` (localStorage `kasa_staff_list_v1`) menyimpan string class `avatarColor: "bg-counterlime text-ink"`. Keduanya akan tetap render berkat token alias (lihat Types/Files).
- `exporters.ts:129` mendeteksi backup dari **struktur** (`parsed.products`), bukan string `app` — rename field `app` & nama file output aman untuk impor.

**Palet biru final (kontras terjaga):**

| Token | Nilai lama | Nilai baru | Peran |
|---|---|---|---|
| `--color-mineral` | `#eef0eb` | `#EDF3FA` | Latar terang kebiruan |
| `--color-ink` | `#14211f` | `#0B1B33` | Navy gelap: teks utama + permukaan header/sidebar |
| `--color-counterlime` → `--color-accent` | `#c7f36b` | `#1F6FEB` | Aksen biru (CTA, active state) |
| `--color-counterlime-dark` → `--color-accent-dark` | `#82b02a` | `#1558BF` | Border/hover aksen |
| `--color-coral` | `#bf493e` | **tetap** | Merah bahaya/urgent |

---

## Types

Tidak ada perubahan tipe data global. Konstanta baru:

```ts
// client/src/components/CategoryManagerModal.tsx (di samping CATEGORY_COLORS)
// Alias untuk id warna kategori lama yang terpersist di IndexedDB:
export const CATEGORY_COLOR_ALIASES: Record<string, string> = {
  counterlime: "accent",
};
export function normalizeCategoryColor(id?: string): string {
  if (!id) return "accent";
  return CATEGORY_COLOR_ALIASES[id] ?? id;
}
```

Aturan kontras saat rename class (pengganti pola lama `bg-counterlime text-ink` yang kontras gelap-di-lime; biru jenuh membutuhkan teks putih):

| Pola lama | Pola baru |
|---|---|
| `bg-counterlime` + `text-ink` (solid) | `bg-accent` + **`text-white`** |
| `bg-counterlime` + `text-ink/XX` (solid, varian) | `bg-accent` + `text-white/XX` |
| `bg-counterlime/15..25` + `text-counterlime` (chip tinted) | `bg-accent/15..25` + `text-accent` |
| `text-counterlime` di atas `bg-ink`/gelap | `text-accent` |
| `border-counterlime` / `bg-counterlime-dark` | `border-accent` / `bg-accent-dark` |

---

## Files

### Dimodifikasi

| Path | Perubahan |
|---|---|
| `d:\00.akmal\bongkaran\kasir-restoran\client\src\index.css` | **Inti.** (a) `@theme`: ganti nilai `--color-mineral` → `#EDF3FA`, `--color-ink` → `#0B1B33`; rename & ganti nilai `--color-counterlime` → `--color-accent: #1F6FEB`, `--color-counterlime-dark` → `--color-accent-dark: #1558BF`. (b) **Pertahankan token alias deprecated** di bawahnya dengan komentar `/* deprecated — hanya untuk class string yang terpersist di data lama */`: `--color-counterlime: #1F6FEB; --color-counterlime-dark: #1558BF;`. (c) Ganti semua warna hardcode: `rgb(20 33 31 / …)` → `rgb(11 27 51 / …)` (baris 22, 26, 74, 95, 172, 185, 243, 274) dan `#14211f` → `#0B1B33` (baris 157, 202, 210, 233, 290); `::selection` pakai `var(--color-accent)`. |
| `client\src\components\KasaLogo.tsx` → **rename file** `GatiLogo.tsx` | Rename export `KasaMark` → `GatiMark`, `KasaLogoBlock` → `GatiLogoBlock`; `StatusDot` tetap. SVG fills: `#14211F` → `#0B1B33`, `#EEF0EB` → `#EDF3FA`, `#C7F36B` → `#1F6FEB`; `aria-label="Logo GATI POS"`; teks brand `"KASA"` → `t.appName` ("GATI POS"), tagline `"SISTEM KASIR"` tetap. |
| `client\src\components\Sidebar.tsx` | Update import dari `./GatiLogo` (baris 19); `KasaMark` → `GatiMark` (baris 112); teks brand baris 116 `"KASA"` → `{t.appName}` (pertimbangkan `text-base` karena "GATI POS" lebih panjang); baris 187 `text-counterlime` → `text-accent`. |
| `client\src\components\FocusModeHeader.tsx` | Import `GatiMark` dari `./GatiLogo` (baris 12, 60); fallback brand baris 64 `"KASA"` → `{t.appName}`. |
| `client\src\components\Header.tsx` | Update import `StatusDot` dari `./GatiLogo` (baris 5). |
| `client\src\locales\en.ts` | `appName: "GATI POS"` (baris 2); `printTitle: "Laporan Penjualan — GATI POS"` (172); `storeNameValue: "GATI POS · Sistem Kasir"` (181); `thanks: "Terima kasih telah berbelanja di GATI POS."` (277). |
| `client\index.html` | `theme-color` `#14211f` → `#0B1B33` (baris 11); description → `"GATI POS — aplikasi kasir untuk warung, kedai kopi, dan restoran kecil."` (13); title → `"GATI POS · Sistem Kasir"` (14). |
| `client\src\pages\CashDrawer.tsx` | Baris 1248 `"KASA SISTEM KASIR"` → `"GATI POS SISTEM KASIR"`. |
| `client\src\pages\CustomerSelfOrder.tsx` | Header baris 269 `"KASA · Menu Meja Pelanggan"` → `"GATI POS · Menu Meja Pelanggan"`; payload QRIS baris 161: `5912KASA RESTO` → `5908GATI POS` (field EMV 59 = nama merchant; panjang prefix HARUS sama dengan isi — "GATI POS" = 8 char); semua class `counterlime` ikut rename global. |
| `client\src\components\PaymentModal.tsx` | Baris 36 payload display → `` `GATI POS\|QRIS-SIMULASI\|PESANAN-${orderNo}\|${totals.total}` ``. |
| `client\src\pages\PrintLayer.tsx` | Baris 59 `"KASA"` → `{t.appName}`. |
| `client\src\pages\QueueDisplay.tsx` | Baris ~347 teks brand header `"KASA"` → `"GATI POS"`; semua class `counterlime` ikut rename global. |
| `client\src\lib\exporters.ts` | Baris 40 `app: "KASA Sistem Kasir"` → `"GATI POS Sistem Kasir"`; nama file output baris 51/71/96 → `gati-cadangan-lengkap-…`, `gati-produk-…`, `gati-laporan-…` (file baru saja — impor hanya cek ekstensi, aman); komentar baris 128 update. |
| `client\src\components\CategoryManagerModal.tsx` | Entri palet `{ id: "counterlime", label: "Lime", … }` → `{ id: "accent", label: "Biru", bg: "bg-accent", border: "border-accent-dark" }` + tambahkan `CATEGORY_COLOR_ALIASES` & `normalizeCategoryColor()` (lihat Types); terapkan normalisasi di semua titik resolve warna kategori (grep pemakaian `CATEGORY_COLORS` / `category.color` — mis. tab kategori POS & chip di Products). |
| `client\src\components\PosContext.tsx` | Baris ~837 default warna kategori `"counterlime"` → `"accent"`. |
| `client\public\favicon.svg` | Ganti fills: `#14211F` → `#0B1B33`, `#EEF0EB` → `#EDF3FA`, `#C7F36B` → `#1F6FEB` (bentuk ikon struk tetap). |
| `client\src\components\AuthContext.tsx` | Default `avatarColor: "bg-counterlime text-ink"` (baris 24) → `"bg-accent text-white"` (data lama di localStorage tetap render via alias token). |
| **Rename global class** (~28 file, 221 kemunculan) | Semua `counterlime` → `accent` / `counterlime-dark` → `accent-dark` di `client/src/**` dengan aturan kontras di atas (AuthContext, BarcodeScanner, CartPanel, Header, Sidebar, MetricStrip, PaymentModal, NetworkHubModal, Modal, PrintLayer, OrderTickets, dsb. + semua pages). Daftar file di-refresh via grep saat eksekusi. |
| `README.md` | Semua penyebutan "KASA" (mulai baris 3) → "GATI POS". |
| `capacitor\capacitor.config.example.ts` | `appName: "KASA"` → `"GATI POS"` (baris 5). **`appId: "id.kasa.kasir"` DIPERTAHANKAN** (per keputusan; rename appId membuat APK terinstal tidak bisa di-update). |
| `capacitor\README.md` | Baris 1 & 14: `cap init "GATI POS" "id.kasa.kasir"`. |
| `client\scripts\generate-pdf-brochure.mjs` | Brand "KASA" + warna lama (baris 7, 45, 361-362) → "GATI POS" + palet biru (`#1F6FEB`, `#0B1B33`, `#EDF3FA`). Prioritas rendah (generator artefak docs, path output eksternal). |
| `docs\*.md` | Update penyebutan brand "KASA" → "GATI POS" bila ada (grep saat eksekusi). |

### Tidak diubah (keputusan eksplisit)

- Semua kunci localStorage `kasa_*` (15 kunci), event `kasa:lan-ip-updated`, nama DB Dexie `"kasa-kasir"` (`client/src/lib/db.ts`), `client/package.json` name `kasa-sistem-kasir` + lockfile — **dipertahankan** agar data lama utuh.
- `client\public\icon-192.png`, `icon-512.png`, `icon-maskable-512.png` — PNG binary tanpa script generator di repo; dibiarkan (favicon.svg adalah ikon utama). Opsi manual: regenerate dari `favicon.svg` dengan tool eksternal bila diinginkan.
- `client\scripts\capture-*.mjs` — memakai kunci localStorage lama yang dipertahankan; tetap valid.

---

## Functions

### Baru

| Nama & Signature | File | Tujuan |
|---|---|---|
| `export function normalizeCategoryColor(id?: string): string` | `client/src/components/CategoryManagerModal.tsx` | Map id warna kategori lama `"counterlime"` (terpersist di IndexedDB) → `"accent"`; fallback `"accent"` untuk nilai kosong. |
| `export function GatiMark({ size = 36 }: { size?: number })` | `client/src/components/GatiLogo.tsx` | Rename dari `KasaMark`; logo SVG dengan palet biru. |
| `export function GatiLogoBlock({ compact = false }: { compact?: boolean })` | `client/src/components/GatiLogo.tsx` | Rename dari `KasaLogoBlock`; render `GatiMark` + `t.appName` + tagline. |

### Dimodifikasi

| Nama | File | Perubahan |
|---|---|---|
| `StatusDot` | `client/src/components/GatiLogo.tsx` | Tanpa perubahan isi; hanya pindah file (export tetap). |
| `CATEGORY_COLORS` | `CategoryManagerModal.tsx` | Entri `counterlime` → `accent` (label "Biru"). |
| `exportBackupJson` | `client/src/lib/exporters.ts` | Field `app` → `"GATI POS Sistem Kasir"`; nama file → `gati-cadangan-lengkap-…`. |
| `importBackupFile` | `client/src/lib/exporters.ts` | **Tanpa perubahan logika** — hanya komentar (deteksi berbasis struktur, sudah diverifikasi). |

### Dihapus

Tidak ada (export `KasaMark`/`KasaLogoBlock` digantikan `GatiMark`/`GatiLogoBlock` — pemakaian hanya di 3 file: Sidebar, FocusModeHeader, Header; semuanya di-update).

---

## Classes

Tidak ada perubahan class (semua komponen React berupa fungsi).

---

## Dependencies

Tidak ada paket baru, tidak ada perubahan versi. Tailwind CSS v4 (`@theme`) sudah mendukung penambahan token `--color-accent` tanpa konfigurasi tambahan; `--color-counterlime` tetap terdefinisi sebagai alias deprecated sehingga class `bg-counterlime` yang terpersist di data lama masih ter-render.

---

## Testing

### Statis
1. `npm run check` (`tsc --noEmit`) di `d:\00.akmal\bongkaran\kasir-restoran\client` — harus 0 error.
2. **Audit grep** (dari root repo):
   - `counterlime` di `client/src/**` hanya tersisa di: alias token `index.css` + `CATEGORY_COLOR_ALIASES` di `CategoryManagerModal.tsx` + komentar. Tidak ada di class JSX/TS aktif.
   - `KASA` di `client/src/**` dan `client/index.html` hanya tersisa di identifier data (`kasa_*` lowercase, event `kasa:lan-ip-updated`) — tidak ada di teks yang tampil ke user.
   - `#14211f` / `#c7f36b` / `rgb(20 33 31` tidak tersisa di `client/src/index.css`.

### Manual (dev server)
1. `npm run dev` → buka `http://localhost:5173/`:
   - **Login screen & sidebar**: logo baru GATI POS, sidebar navy `#0B1B33`, teks aksen biru terbaca jelas di atas navy.
   - **POS (Home)**: latar `#EDF3FA` kebiruan; tombol/CTA aksen biru `#1F6FEB` dengan teks putih; chip kategori dengan warna lama (id `counterlime`) tetap render biru (bukti alias bekerja).
2. **Struk (PrintLayer) & CashDrawer**: header "GATI POS", teks navy di atas kertas putih.
3. **Self-order** (`/order/:tableId`): header "GATI POS · Menu Meja Pelanggan"; payload QRIS `5908GATI POS` (prefix-panjang konsisten).
4. **Queue display** (`/antrian`): brand "GATI POS", aksen biru.
5. **Data lama**: login dengan akun staff lama (avatar `bg-counterlime` dari localStorage) → avatar tetap berwarna (biru via alias), tidak "hilang warna".
6. **Backup**: impor file backup lama `kasa-cadangan-lengkap-*.json` di Pengaturan → sukses (deteksi struktur, bukan nama). Ekspor baru → file bernama `gati-cadangan-lengkap-*.json`, field `app` = "GATI POS Sistem Kasir".
7. **Favicon & title tab**: favicon biru, title "GATI POS · Sistem Kasir".

### Regresi cepat
- Buat kategori baru (default warna harus "accent"/Biru), ganti palet warnanya, restart tab → warna tetap (persist ter-resolve tanpa alias).

---

## Implementation Order

1. **`client/src/index.css`** — token `@theme` baru + alias deprecated + ganti semua warna hardcode (`rgb(20 33 31)`, `#14211f`). Cek visual di dev server: seluruh app langsung berganti biru (class lama `counterlime` masih jalan via alias — state sementara yang aman).
2. **Rename global class** `counterlime` → `accent` (+ `counterlime-dark` → `accent-dark`) di seluruh `client/src/**` dengan aturan kontras (`text-ink` → `text-white` pada bg solid aksen). Refresh grep `counterlime` setelah selesai; jalankan `npm run check`.
3. **Warna kategori kompatibel** — `CategoryManagerModal.tsx` (palet + `normalizeCategoryColor()` + terapkan di titik resolve), `PosContext.tsx:837` default → `"accent"`, `AuthContext.tsx:24` avatarColor default → `"bg-accent text-white"`.
4. **`KasaLogo.tsx` → `GatiLogo.tsx`** — rename file & export, ganti warna SVG, brand text pakai `t.appName`; update import di `Sidebar.tsx`, `FocusModeHeader.tsx`, `Header.tsx`. Jalankan `npm run check`.
5. **`locales/en.ts`** — `appName`, `printTitle`, `storeNameValue`, `thanks`.
6. **Teks brand yang tampil** — `Sidebar.tsx:116`, `FocusModeHeader.tsx:64`, `PrintLayer.tsx:59`, `CashDrawer.tsx:1248`, `CustomerSelfOrder.tsx:161+269`, `PaymentModal.tsx:36`, `QueueDisplay.tsx:~347`.
7. **`client/index.html` + `client/public/favicon.svg`** — title, description, theme-color, warna favicon.
8. **`exporters.ts`** — field `app`, nama file output `gati-*`, komentar.
9. **Dokumen & artefak** — `README.md`, `capacitor/capacitor.config.example.ts` + `capacitor/README.md`, `docs/*.md`, `client/scripts/generate-pdf-brochure.mjs`.
10. **Validasi akhir** — `npm run check`, audit grep (Testing → Statis), smoke test manual lengkap (Testing → Manual), opsional regenerate ikon PNG dari `favicon.svg`.

---

## Edge Cases & Keputusan Desain

- **Class string terpersist di data lama** (staff `avatarColor`, kategori `color`): dua lapis perlindungan — (1) alias token `--color-counterlime` di `@theme` membuat class lama tetap render biru, (2) `normalizeCategoryColor()` memetakan id lama → baru saat resolve. Tidak ada migrasi destruktif data.
- **Kontras biru vs teks**: lime terang lama aman dengan teks gelap; biru jenuh `#1F6FEB` TIDAK — karena itu setiap `bg-accent` solid wajib `text-white`/`text-white/XX` (aturan mapping di Types). `text-accent` di atas navy `#0B1B33` rasio ~4:1 — aman untuk teks display/bold; bila saat review visual ada teks kecil yang kurang terbaca, gunakan varian lebih terang (`#5B9DFF`) pada kasus itu saja.
- **Payload QRIS (simulasi EMVCo)**: field 59 (merchant name) memakai prefix panjang — "GATI POS" = 8 char → `5908GATI POS`. Jangan pakai "GATI POS RESTO" (14 char) tanpa mengubah prefix ke `5914`. Ini string simulasi (tidak discan bank sungguhan), tapi konsistensi tetap dijaga.
- **Nama brand lebih panjang** ("GATI POS" 8 char vs "KASA" 4): Sidebar & logo block mungkin butuh `text-base`/penyesuaian `tracking` agar tidak wrap; header struk (font mono lebar tetap) aman.
- **`prefers-reduced-motion`** dan perilaku fokus/keyboard tidak tersentuh — hanya warna & teks yang berubah.
- **Identifier data `kasa_*` TIDAK di-rename** (keputusan user) — konsekuensi: developer membaca kunci `kasa_` di kode aplikasi bernama GATI POS. Diputuskan demi keutuhan data pengguna yang sudah terpasang; tidak ada risiko fungsional.
- **`appId` Capacitor tetap `id.kasa.kasir`** — rename akan membuat APK terinstal tidak bisa di-update; hanya `appName` (yang tampil ke user) yang diganti.
- **Ikon PNG (192/512/maskable)**: masih memakai warna lama sampai di-regenerate manual — dampak hanya pada home-screen install (PWA/APK); `favicon.svg` (dipakai tab browser) langsung biru.
