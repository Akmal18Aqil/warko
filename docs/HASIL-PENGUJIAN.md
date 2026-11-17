# Hasil Pengujian UAT — WAKRO Digital POS & Self-Order

Eksekusi seluruh kasus di [SKEMA-PENGUJIAN.md](SKEMA-PENGUJIAN.md) pada 17 November 2026. Putaran pertama suite UAT (`apps/e2e/playwright.uat.config.ts`, 95 tes) menghasilkan 90 lulus dan 5 gagal, semuanya akibat temuan F1. Setelah F1, F2, dan F3 diperbaiki (§4), putaran ulang lulus semua: 95 tes UAT, `pnpm test` 143 tes, dan `pnpm test:e2e` 7 tes.

## 1. Ringkasan

| Bagian | Kasus | LULUS | GAGAL | Tidak dapat dieksekusi (perangkat fisik) |
|---|---|---|---|---|
| Pelanggan (PLG) | 25 | 24 | 1 (PLG-25, sebagian) | — |
| Dapur (DPR) | 18 | 18 | — | bunyi bel di speaker tablet |
| Kasir (KSR) | 25 | 25 | — | cetak fisik printer thermal |
| Owner (OWN) | 22 | 22 | — | — |
| Integrasi (INT) | 6 | 6 | — | uji 3× dengan 4 perangkat fisik |
| Keamanan (SEC) | 12 | 12 | — | — |
| Lanjutan (ADV) | 13 | 13 | — | scan kamera dari stiker kertas, Midtrans sandbox asli |
| Non-fungsional (NFR) | 7 | 6 | 1 (NFR-06, sebagian) | HP/tablet fisik |

Tabel di atas menunjukkan hasil setelah perbaikan. **Status rilis:** semua kasus P1 yang bisa dijalankan otomatis sudah lulus. Kriteria uji 3× dengan 4 perangkat fisik (§11.3 skema) dan uji manual di §5 masih harus dijalankan. Sisa kegagalan sebagian ada di PLG-25 dan NFR-06 (F4, ukuran tombol).

Uji otomatis pendukung juga lulus: `pnpm test` (shared 6, web 62, API 72) dan `pnpm test:e2e` (7).

## 2. Lingkungan & metode

- **Mode server (remote)**: Worker + D1 lokal (`wrangler dev`) dari build produksi web, database baru diisi `apps/e2e/uat/seed.sql`. Isinya Lantai 1, Lantai 2, Rooftop, 29 meja, dan menu dengan stok tidak dilacak, stok 50, stok 6, stok 1, dan stok 0.
- **Dua instance**: port 8797 dengan QRIS aktif yang memakai tiruan Midtrans (`apps/e2e/uat/midtrans-mock.mjs`: charge, status transaksi, notifikasi bertanda tangan SHA-512), dan port 8796 tanpa `MIDTRANS_SERVER_KEY` untuk PLG-15.
- **Mode demo (local)**: build `dist-demo`, untuk PLG-14, SEC-07, dan NFR-07.
- **Akun**: admin, `kasir1`, `kasir2`, `dapur1`, `owner1` (manajer), dan `pelayan1`, dibuat lewat API admin.
- **Perangkat**: setiap peran berjalan di konteks browser sendiri (sesi, penyimpanan, dan viewport terpisah). HP pelanggan diemulasikan 390×844 dan 360×740 dengan layar sentuh. Sinkronisasi diukur antar konteks, bukan antar perangkat fisik.
- **Mesin browser**: Chromium (utama), WebKit (profil iPhone 13), Firefox, dan Microsoft Edge.
- **Hal yang tidak bisa diamati langsung**:
  - Bunyi bel diverifikasi dari jumlah osilator Web Audio yang dimulai, bukan dari suara di speaker.
  - Cetak browser diverifikasi dari isi lapisan cetak saat `window.print()` dipanggil.
  - QR didekode dengan ZXing dari gambar yang dirender aplikasi.
  - Printer Bluetooth dianalisis dari byte ESC/POS yang dihasilkan (`apps/e2e/uat-results/escpos-sample.txt`, tidak di-commit).

Menjalankan ulang:

```bash
pnpm --filter @wakro/e2e exec playwright install chromium webkit firefox
pnpm test:uat        # build web, D1 baru, 95 tes; laporan JSON di apps/e2e/uat-results/
```

## 3. Hasil per peran

Kolom **Tes** merujuk ke file di `apps/e2e/uat/`.

### 3.1 Pelanggan

| ID | Hasil | Bukti / catatan | Tes |
|---|---|---|---|
| PLG-01 | LULUS | `/order/l1-m3` langsung menampilkan "Meja 3 · Lantai 1" dan menu | server/01 |
| PLG-02 | LULUS | Pesan QR tak dikenal muncul dan pemilih meja terbuka | server/01 |
| PLG-03 | LULUS | `/order` membuka pemilih lantai & meja | server/01 |
| PLG-04 | LULUS | Tab Lantai 1 / Lantai 2 / Rooftop hanya menampilkan meja di lantai itu | server/01 |
| PLG-05 | LULUS | Isi keranjang tetap setelah ganti meja; pesanan tersimpan di `l2-m5` · Lantai 2 | server/01 |
| PLG-06 | LULUS | Tombol pesan nonaktif dengan teks "Pilih meja terlebih dahulu." | server/01 |
| PLG-07, PLG-08 | LULUS | Jumlah dan total (termasuk PPN 11%) berubah saat tambah/kurang; item hilang di qty 0 | server/01 |
| PLG-09 | LULUS | Badge HABIS dan "Menu habis hari ini", tanpa tombol tambah | server/01 |
| PLG-10 | LULUS | Penambahan berhenti di 6 dengan pesan "Stok Ayam Geprek tinggal 6"; API menolak qty 7 | server/01 |
| PLG-11, PLG-12, PLG-17 | LULUS | Catatan tersimpan per item; status "Diterima Dapur" dan "Belum bayar" | server/01 |
| PLG-13 | LULUS | "Pembayaran diterima" muncul ≤ 10 dtk setelah kasir melunasi | server/01 |
| PLG-14 [L] | LULUS | Simulasi QRIS demo melunasi pesanan; struk digital terbuka otomatis | demo |
| PLG-15 | LULUS | `/api/public/payments` → `qris:false`; tombol QRIS tidak ada | server/01 |
| PLG-16 | LULUS | E-struk memuat toko, no., meja/lantai, item + catatan, subtotal, pajak, total, tunai, kembalian, waktu; "Simpan / Cetak" memanggil cetak | server/01 |
| PLG-18 | LULUS | Sedang Dimasak → Siap Diantar + banner, masing-masing ≤ 10 dtk | server/01 |
| PLG-19 | LULUS | Pesanan tetap terlacak setelah reload dan setelah tab ditutup | server/01 |
| PLG-20, PLG-22 | LULUS | 5 klik cepat + back/forward/reload → tepat 1 pesanan | server/01 |
| PLG-21 | LULUS | Respons dibuang jaringan → "Kirim ulang" → tetap 1 pesanan | server/01 |
| PLG-23 | LULUS | Tanpa kunci / kunci salah / nomor pesanan lain → ditolak (404/422); API staf 401 | server/01 |
| PLG-24 | LULUS | `/`, `/dapur`, `/pesanan`, `/laporan` menampilkan form login | server/01 |
| PLG-25 | **GAGAL (sebagian)** | Tidak ada geser horizontal di 360 px. Namun 12 tombol < 44 px (lihat **F4**) | server/01 |

### 3.2 Dapur

| ID | Hasil | Bukti / catatan | Tes |
|---|---|---|---|
| DPR-01 | LULUS (setelah perbaikan F1) | Login dapur langsung ke `/dapur`. Sebelum perbaikan: tetap di `/` dengan layar "Akses Terkunci" | server/02 |
| DPR-02 | LULUS | "Bel aktif" dan toast muncul; osilator Web Audio berbunyi | server/02 |
| DPR-03 | LULUS | Toast "Pesanan baru #N · Meja 1 · Lantai 1" dan "2 item · Belum bayar" ≤ 10 dtk; bel diputar ulang | server/02 |
| DPR-04 | LULUS | Label asal "QR Self-Order", "Kasir POS", "Pelayan: Budi Pelayan" | server/02 |
| DPR-05 | LULUS | Nomor "Urutan ke-n" naik sesuai urutan pesanan masuk | server/02 |
| DPR-06 … 08 | LULUS | Menu, porsi, meja, lantai, Takeaway, catatan, LUNAS/BELUM BAYAR tampil | server/02 |
| DPR-09 … 11 | LULUS | Tiga tombol mengubah status; status pelanggan ikut berubah; tiket hilang setelah diantar | server/02 |
| DPR-12 | LULUS | Diantar tapi belum bayar → tetap `unpaid`; dapur melunasi → 403 | server/02 |
| DPR-13 | LULUS | Badge berubah ke LUNAS ≤ 10 dtk, status tetap "Dimasak" | server/02 |
| DPR-14 | LULUS | Angka filter sama dengan data server | server/02 |
| DPR-15 | LULUS | Timer menunjukkan 6 mnt lalu 16 mnt, muncul "Prioritas!" (jam dipercepat) | server/02 |
| DPR-16 | LULUS | "Tidak ada tiket masak aktif" | server/02 |
| DPR-17 | LULUS | Tablet B ikut berubah ≤ 10 dtk; klik bersamaan tidak membuat status mundur | server/02 |
| DPR-18 | LULUS | `/`, `/laporan`, `/produk`, `/pesanan`, `/laci-kas` terkunci; tombol kembali ke `/dapur` | server/02 |

### 3.3 Kasir

| ID | Hasil | Bukti / catatan | Tes |
|---|---|---|---|
| KSR-01 | LULUS | Shift aktif dengan modal Rp 200.000 atas nama Jamie Kasir | server/00 |
| KSR-02 | LULUS | Pilihan Tunai nonaktif dengan teks "Buka shift di Laci Kas untuk menerima tunai" | server/00 |
| KSR-03 | LULUS | Filter lantai: jumlah kartu dan "x kosong + y terisi" sama dengan total meja di lantai itu | server/03 |
| KSR-04 … 07 | LULUS | Hijau → amber ≤ 10 dtk; kembali hijau hanya jika lunas **dan** diantar | server/03 |
| KSR-08 | LULUS | Takeaway Mie Ayam, bayar Rp 100.000 → kembalian Rp 80.020; lunas; stok berkurang 1 | server/03 |
| KSR-09 | LULUS | Makan di tempat Meja 14 + catatan, Kirim ke dapur → `unpaid`, meja Terisi | server/03 |
| KSR-10 | LULUS | Tombol menu HABIS nonaktif | server/03 |
| KSR-11 | LULUS | Diskon 10%: 50.000 − 5.000, PPN 4.950, total 49.950 (server: subtotal 45.000 = setelah diskon) | server/03 |
| KSR-12 | LULUS | "Terima Bayar" mengubah status ke "Lunas · Tunai" tanpa menambah pesanan | server/03 |
| KSR-13 | LULUS | Muncul "Kurang: Rp …" dan "Uang tunai masih kurang"; tombol selesai nonaktif | server/03 |
| KSR-14 | LULUS | "Uang pas" mengisi nominal tepat; ada tombol pembulatan Rp 50.000 | server/03 |
| KSR-15 | LULUS | "Penjualan Tunai Shift" bertambah tepat sebesar total pesanan | server/03 |
| KSR-16 | LULUS | Dua kasir melunasi bersamaan → satu "Pembayaran berhasil", satu "sudah lunas sebelumnya"; kas tercatat sekali | server/03 |
| KSR-17 | LULUS | Lapisan cetak berisi struk pesanan yang dibayar; lebar struk 48 mm untuk kertas 58 mm (setelah perbaikan F3) | server/03 |
| KSR-18 | LULUS (byte ESC/POS, setelah perbaikan F2); cetak fisik tidak dapat dieksekusi | Hanya ASCII; baris ≤ 32/48 kolom; nama + catatan panjang dibungkus, tidak dipotong | `apps/web/src/services/printer/escpos.test.ts` |
| KSR-19 | LULUS | Struk browser: toko, PESANAN n, meja/Takeaway, item + catatan, pajak, TOTAL, tunai, kembalian, kasir, waktu, penutup | server/03, server/05 |
| KSR-20 | LULUS | Cetak ulang dari Pesanan menampilkan no. dan total yang sama, termasuk baris diskon | server/03 |
| KSR-21 | LULUS | Pemilih printer tanpa perangkat → "Pemilihan printer Bluetooth dibatalkan."; pesanan tetap lunas | server/03 |
| KSR-22 | LULUS | Meja 20 Rooftop muncul di denah dan di menu pelanggan | server/03 |
| KSR-23 | LULUS | Penghapusan meja ditolak di UI dan API (409, "pesanan aktif") | server/03 |
| KSR-24 | LULUS | Cetak QR Lantai 2: jumlah stiker sama dengan jumlah meja; QR berisi `/order/<id>` yang benar | server/07 |
| KSR-25 | LULUS | 5 klik "Selesaikan pembayaran" → tepat 1 pesanan | server/03 |

### 3.4 Owner

| ID | Hasil | Bukti / catatan | Tes |
|---|---|---|---|
| OWN-01 | LULUS (setelah perbaikan F1) | Login owner langsung ke `/laporan` | server/04 |
| OWN-02 … 05 | LULUS | Omset, jumlah, rata-rata, dan produk terlaris sama dengan perhitungan dari API laporan; pesanan belum bayar tidak dihitung | server/04 |
| OWN-06 | LULUS | Omset dan jumlah transaksi bertambah ≤ 10 dtk setelah kasir melunasi | server/04 |
| OWN-07, OWN-08 | LULUS | Tooltip batang "jam — Rp · n transaksi"; per jam (hari ini) dan per hari (7/30 hari, bulan ini); pilih tanggal | server/04 |
| OWN-09 | LULUS | Pesan "Belum ada penjualan…"; tombol ekspor nonaktif | server/04 |
| OWN-10 … 13 | LULUS | Set 6; −2 → peringatan < 5 di Produk, Laporan, dan HP pelanggan ("Sisa 4"); −10 diblokir di UI & API; berhenti lacak | server/04 |
| OWN-14 … 16 | LULUS | Stok 6 → 4 → 0 → HABIS terkunci di pelanggan, POS, dan API; isi ulang 10 membuka kunci | server/04 |
| OWN-17 | LULUS | 7 kolom tampil; jumlah baris sama dengan transaksi lunas | server/04 |
| OWN-18 | LULUS | CSV dengan BOM UTF-8, pemisah `;`, jumlah baris sesuai, memuat no. & total | server/04 |
| OWN-19 | LULUS | `.xlsx` terbaca oleh SheetJS dan memuat no. & total | server/04 |
| OWN-20 | LULUS | Cetak/PDF berisi "Laporan Penjualan" | server/04 |
| OWN-21, OWN-22 | LULUS | POS, dapur, pelayan terkunci; Pesanan & Meja hanya bisa dilihat; pelunasan, pajak, dan meja ditolak server (403) | server/04 |

### 3.5 Integrasi

| ID | Hasil | Bukti / catatan | Tes |
|---|---|---|---|
| INT-01 | LULUS | Satu skenario dengan 4 konteks: HP pesan → bel + 3 status dapur → meja amber → bayar tunai dari kartu meja → cetak → meja hijau → omset bertambah, muncul di riwayat dan CSV | server/05 |
| INT-02 | LULUS | QRIS → notifikasi Midtrans → HP lunas otomatis, struk terbuka, dapur LUNAS, `paidBy` "QRIS Midtrans", omset bertambah | server/05 |
| INT-03 | LULUS | Stok 1, dua HP menekan kirim bersamaan → 1 diterima, 1 ditolak; stok 0; pesanan yang ditolak tidak tersimpan sebagian | server/05 |
| INT-04 | LULUS | Dua POST paralel dengan `clientRef` sama → nomor sama, 1 tiket, 1 baris | server/05 |
| INT-05 | LULUS | Pesanan pelayan dilunasi kasir; nomor tetap, `source` waiter, `paidBy` Jamie Kasir | server/05 |
| INT-06 | LULUS | Uang di laci = modal + penjualan tunai; selisih −5.000 / +2.000 / Pas tampil benar; Z-Report dibuat | server/09 |

### 3.6 Keamanan

| ID | Hasil | Bukti / catatan | Tes |
|---|---|---|---|
| SEC-01 | LULUS | Halaman staf meminta login; `/api/bootstrap`, orders, staff, shifts, laporan → 401 | server/06 |
| SEC-02 | LULUS (setelah perbaikan F1) | Kasir ke `/`, manajer ke `/laporan`, dapur ke `/dapur`, pelayan ke `/pelayan` | server/06 |
| SEC-03 | LULUS | Pengguna tak dikenal dan sandi salah mendapat status & pesan identik | server/06 |
| SEC-04 | LULUS | Setelah 5 kali gagal → 429, `Retry-After: 900`; sandi benar pun ditolak | server/06 |
| SEC-05 | LULUS | Logout → Back tetap menampilkan login; sesi server kosong | server/06 |
| SEC-06 | LULUS | Cookie `Max-Age=43200`, HttpOnly, SameSite; sesi kedaluwarsa (dipaksa di D1) → 401 | server/06 |
| SEC-07 [L] | LULUS | PIN salah ditolak; PIN 3333 → `/dapur` | demo |
| SEC-08 | LULUS | Matriks 5 peran × 9 rute sesuai tabel skema | server/06 |
| SEC-09 | LULUS | 8 aksi di luar peran → 403; Origin asing → 403; data tidak berubah | server/06 |
| SEC-10 | LULUS | `expectedTotal` palsu ditolak ("Total pesanan berubah…"); `price` dari klien ditolak; `paid-now` publik → 422 | server/06 |
| SEC-11 | LULUS | Pesanan menu stok 0 lewat API ditolak | server/06 |
| SEC-12 | LULUS | Sama dengan PLG-23 | server/01 |
| (tambahan) SEC-13 | LULUS | Bootstrap admin kedua → 409 | server/06 |

### 3.7 Pengembangan lanjutan

| ID | Hasil | Bukti / catatan | Tes |
|---|---|---|---|
| ADV-PG-01 | LULUS | QR berisi id charge; nominal = total pesanan; masa berlaku 14–15 menit | server/07 |
| ADV-PG-02 | LULUS | Lunas otomatis ≤ 10 dtk, modal QR tertutup | server/07 |
| ADV-PG-03 | LULUS | Signature salah → 401; pesanan tetap belum bayar | server/07 |
| ADV-PG-04 | LULUS | Nominal Midtrans berbeda → tidak dilunasi | server/07 |
| ADV-PG-05 | LULUS | pending/deny/expire tidak melunasi; QR baru dibuat setelah gagal | server/07 |
| ADV-PG-06 | LULUS | 4 notifikasi settlement → lunas sekali, `paidAt` tetap, 1 baris laporan | server/07 |
| ADV-PG-07 | LULUS | QR yang masih berlaku dipakai ulang; setelah kedaluwarsa (dipaksa di D1) QR baru dibuat | server/07 |
| ADV-PG-08 | LULUS | Gateway mati → pesan "tidak tersedia … bayar tunai di kasir"; tiket tetap masuk dapur | server/07 |
| ADV-QR-01 | LULUS | 6 QR meja unik, isi = `<origin>/order/<id-meja>` | server/07 |
| ADV-QR-02 | LULUS (digital); scan fisik tidak dapat dieksekusi | Gambar QR terdekode ZXing | server/07 |
| ADV-QR-03 | LULUS (dengan observasi **O1**) | Host QR = alamat yang dibuka staf | server/07 |
| ADV-QR-04 | LULUS | Setelah ganti nama/lantai, `/order/rt-m7` membuka "Meja 7 VIP · Lantai 2" | server/07 |
| ADV-QR-05 | LULUS | "Tersalin!" dan isi clipboard = URL | server/07 |

Catatan: Midtrans diuji dengan tiruan berprotokol sama, bukan akun sandbox Midtrans asli.

### 3.8 Non-fungsional

| ID | Hasil | Bukti / catatan | Tes |
|---|---|---|---|
| NFR-01 | LULUS | Latensi (3 sampel): dapur 4,3–4,4 dtk, denah kasir 4,6 dtk, pesanan owner 4,9–5,0 dtk | server/08 |
| NFR-02 | LULUS | 20 pesanan paralel dari 5 HP → semua 201, 20 nomor unik, 20 tiket dapur | server/08 |
| NFR-03 | LULUS | Slow 3G emulasi (latensi 2 dtk, 500 kbps): muat + pesan berhasil, 1 pesanan | server/08 |
| NFR-04 | LULUS | Pelanggan berhasil pesan di WebKit (iPhone 13), Firefox, dan Chrome Android emulasi; POS & KDS terbuka di Microsoft Edge | server/08 |
| NFR-05 | LULUS | Tanpa geser horizontal di 8 kombinasi peran/viewport | server/08 |
| NFR-06 | **GAGAL (sebagian)** | Status selalu disertai teks; target sentuh < 44 px banyak (lihat **F4**) | server/08 |
| NFR-07 [L] | LULUS | Reset demo menghapus pesanan dan memuat ulang | demo |

## 4. Temuan

### F1 — Login di mode server tidak membuka modul peran (Tinggi, P1) — **DIPERBAIKI**

- **Kasus**: DPR-01, OWN-01, SEC-02 (manajer, dapur, pelayan).
- **Langkah**: buka `/`, login sebagai `dapur1` (atau `owner1`, `pelayan1`).
- **Diharapkan**: diarahkan ke `/dapur` (manajer `/laporan`, pelayan `/pelayan`).
- **Aktual**: tetap di `/`. Layar menampilkan "Akses Terkunci untuk Peran Ini" sehingga staf harus menekan "Kembali ke Modul …". Bukti: `apps/e2e/uat-results/artifacts/server-02-dapur-DPR-01-*/test-failed-1.png`.
- **Penyebab**: `RemoteAuthGate` hanya memasang sesi. Pengalihan `defaultRouteFor(role)` hanya dipanggil di `enter()` (`apps/web/src/state/auth.tsx`), yang dipakai Quick Switch PIN di mode demo.
- **Ikutan**: teks layar terkunci di mode server menyebut "dikhususkan untuk Kasir atau Manajer" (manajer justru tidak boleh membuka POS) dan menampilkan tombol "Ganti Staf / Masukkan PIN Kasir", padahal mode server tidak memakai PIN.

### F2 — Struk thermal Bluetooth (ESC/POS) (Sedang) — **DIPERBAIKI**

- **Kasus**: KSR-18, KSR-19 (jalur Bluetooth).
- **(a) Hanya 58 mm.** `EscPosBluetoothDriver` selalu memanggil `generateEscPosReceipt(payload, 58)`, sehingga kertas 80 mm tidak bisa dipilih. README menyebut 58 & 80 mm.
- **(b) Karakter non-ASCII dikirim mentah.** Teks dikirim sebagai UTF-8. Sampel struk berisi 16 byte non-ASCII: spasi tak-putus di "Rp 50.000" dan "·" di "Meja 4 · Lantai 2". [INFERENCE] Printer dengan code page bawaan satu byte (umumnya PC437) akan mencetak 2 karakter sampah per simbol dan baris kolom bergeser 1 karakter.
- **(c) Catatan item tidak dicetak.** Contoh: "tanpa bawang". Catatan ini ada di struk browser dan e-struk.
- **(d) Nama menu panjang dipotong.** Contoh: "Nasi Goreng WakRo S" di 58 mm.

### F3 — Lebar struk cetak browser 64 mm (Sedang–Rendah) — **DIPERBAIKI**

- **Kasus**: KSR-17.
- `.receipt-print { width: 64mm }` ditambah `@page { margin: 8mm }`, total 80 mm. [INFERENCE] Pada printer 58 mm (area cetak ±48 mm), struk terpotong atau diskalakan.

### F4 — Target sentuh di bawah 44 px (Rendah) — terbuka

- **Kasus**: PLG-25, NFR-06.
- **Pelanggan 360 px**: 12 tombol di bawah 44 px. "Ganti meja" dan label meja 16 px; tambah/kurang 32–36 px; tab kategori 36 px.
- **Staf**: elemen < 44 px berjumlah Meja (HP) 138, Pesanan (HP) 165, Dapur (tablet) 124, POS (HP) 7. Angka ini ikut naik dengan jumlah pesanan yang tampil.
- README menyatakan "Minimal 44px".

### Observasi (bukan kegagalan)

- **O1 — Alamat di QR meja.** QR memakai alamat tempat staf membuka aplikasi. Jika dibuka dari `localhost`/`127.0.0.1` tanpa IP LAN tersimpan, QR berisi alamat yang tidak bisa dijangkau HP. Di domain produksi hal ini tidak terjadi.
- **O2 — Struk percobaan di mode server.** "Cetak struk" pada keranjang POS kosong mencetak "Struk percobaan — data lokal" dengan nomor pesanan berikutnya, padahal mode server tidak memakai data lokal.
- **O3 — Ketikan PIN diabaikan sesaat (mode demo).** Setelah PIN salah, ketikan dalam 600 ms diabaikan karena kolom PIN sedang dikosongkan.

### Perbaikan yang diterapkan

- **F1** (`apps/web/src/state/auth.tsx`, `apps/web/src/app/RouteGuard.tsx`):
  - Login atau membuka aplikasi di `/` dengan peran yang tidak boleh memakai kasir langsung dialihkan ke modul peran itu. Ini berlaku di mode server dan demo.
  - Teks layar terkunci kini netral: "tidak tersedia untuk peran Anda".
  - Di mode server tombolnya "Keluar / ganti akun", bukan "Masukkan PIN".
- **F2** (`apps/web/src/services/printer/escpos.ts`, `paper.ts`, `EscPosBluetoothDriver.ts`):
  - Pilihan lebar kertas 58/80 mm ada di **Pengaturan → Printer struk**.
  - Semua teks dikonversi ke ASCII sebelum dikirim.
  - Baris item dibungkus ke baris berikutnya, tidak dipotong, sehingga catatan ikut tercetak.
- **F3** (`apps/web/src/features/printing/PrintLayer.tsx`, `apps/web/src/index.css`): lebar struk mengikuti kertas (48 mm untuk 58 mm, 72 mm untuk 80 mm), margin halaman 0 saat mencetak struk, dan struk diletakkan di tengah. Hasil pengukuran: 48,0 mm untuk kertas 58 mm.
- Tes otomatis yang menyesuaikan perilaku baru: DPR-18, OWN-21, dan SEC-08 kini mengharapkan `/` dialihkan, bukan terkunci.

## 5. Yang tetap perlu diuji manual di lokasi

1. Bel KDS terdengar dari speaker tablet dapur, termasuk setelah layar terkunci atau tab di latar.
2. Cetak fisik di printer thermal 58 mm dan 80 mm, lewat Bluetooth dan USB/dialog browser (cek F2 dan F3).
3. Scan stiker QR kertas dari jarak 20–40 cm dengan minimal 2 merek HP.
4. INT-01 dan INT-02 3× berturut-turut dengan 4 perangkat fisik di jaringan restoran.
5. QRIS dengan akun Midtrans sandbox asli: Payment Notification URL publik dan simulator pembayaran Midtrans.
