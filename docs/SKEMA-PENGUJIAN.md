# Skema Pengujian — WAKRO Digital POS & Self-Order

Dokumen ini adalah skema pengujian *User Acceptance Test* (UAT) per peran sesuai **Project Brief WAKRO Digital POS & Self-Order System**. Setiap butir brief dipetakan ke minimal satu kasus uji (lihat [§2 Matriks Keterlacakan](#2-matriks-keterlacakan-brief--kasus-uji)).

---

## 1. Persiapan

### 1.1 Lingkungan uji

| Mode | Cara menjalankan | Dipakai untuk |
|---|---|---|
| **Demo lokal** (`VITE_DATA_SOURCE=local`, bawaan dev) | `pnpm --filter @wakro/web dev` | Uji tampilan & alur di satu browser; sinkron antar-tab, QRIS = simulasi |
| **Remote** (Worker + D1) | `VITE_DATA_SOURCE=remote` + `pnpm dev` (web :5173 + API :8787), atau staging | Uji multi-perangkat, login staf, keamanan role, stok atomik, QRIS Midtrans sandbox |

Kasus bertanda **[R]** wajib dijalankan di mode remote. Kasus bertanda **[L]** khusus mode demo lokal. Tanpa tanda = jalankan di kedua mode.

### 1.2 Perangkat

| Peran | Perangkat yang disarankan |
|---|---|
| Pelanggan | 2 HP (Android Chrome + iPhone Safari), kamera aktif |
| Dapur | Tablet landscape, speaker menyala |
| Kasir | Laptop/PC Chrome atau Edge + printer thermal 58 mm/80 mm (Bluetooth atau USB) |
| Owner | Laptop + HP (cek tampilan responsif) |

### 1.3 Akun uji

| Peran brief | Role sistem | Mode demo (PIN) | Mode remote |
|---|---|---|---|
| Pelanggan | — (tanpa login) | — | — |
| Dapur | `dapur` | Chef Junaedi `3333` | akun `dapur` di D1 |
| Kasir | `kasir` / `admin` | Jamie Morgan `1234` / Dewi Lestari `0000` | akun `kasir` di D1 |
| Owner | `manajer` (dan `admin`) | Hendra Wijaya `8888` | akun `manajer` di D1 |
| (pendukung) Pelayan | `pelayan` | Budi `2222` | akun `pelayan` di D1 |

### 1.4 Data uji awal (seed)

Siapkan sebelum eksekusi, lalu catat nilainya di lembar eksekusi:

| Data | Nilai |
|---|---|
| Lantai | Lantai 1, Lantai 2, Rooftop (minimal 2 meja per lantai) |
| Produk A — stok dilacak | stok **6** (untuk uji peringatan < 5 dan HABIS) |
| Produk B — stok dilacak | stok **1** (untuk uji balapan stok) |
| Produk C — tidak dilacak | stok `NULL` / "Tidak dilacak" |
| Produk D — stok 0 | sudah **HABIS** |
| Shift kasir | belum dibuka (dibuka di KSR-01) |

### 1.5 Konvensi

- **ID**: `PLG` Pelanggan, `DPR` Dapur, `KSR` Kasir, `OWN` Owner, `INT` integrasi lintas peran, `SEC` keamanan & akses, `ADV` pengembangan lanjutan, `NFR` non-fungsional.
- **Prioritas**: **P1** = penghalang rilis, **P2** = penting, **P3** = kosmetik/kenyamanan.
- **Hasil**: `LULUS` / `GAGAL` / `TERBLOKIR` / `N/A`. Setiap `GAGAL` wajib disertai bukti (tangkapan layar/video, no. pesanan, waktu).
- **Real-time**: di mode remote perangkat staf memuat ulang data tiap ±5 detik. Batas lulus "real-time" = perubahan tampil **≤ 10 detik** tanpa refresh manual.

---

## 2. Matriks Keterlacakan Brief → Kasus Uji

| Butir brief | Kasus uji |
|---|---|
| **Pelanggan** — akses menu via scan QR meja | PLG-01, PLG-02, PLG-03, ADV-QR-01…05 |
| Pelanggan — pilih Lantai & Nomor Meja | PLG-04, PLG-05, PLG-06 |
| Pelanggan — pilih menu & catatan khusus | PLG-07…PLG-11 |
| Pelanggan — bayar QRIS mandiri + struk digital | PLG-14, PLG-15, PLG-16, ADV-PG-01…08 |
| Pelanggan — bayar tunai di kasir | PLG-12, PLG-13, KSR-12…16 |
| Pelanggan — pantau progres (Diterima ➔ Dimasak ➔ Siap) | PLG-17, PLG-18, PLG-19 |
| **Dapur** — notifikasi bunyi (bell) | DPR-02, DPR-03 |
| Dapur — kartu pesanan otomatis | DPR-04, DPR-05 |
| Dapur — detail menu, porsi, meja, lantai, catatan, status bayar | DPR-06, DPR-07, DPR-08 |
| Dapur — ubah status Diterima ➔ Dimasak ➔ Selesai/Ready | DPR-09…DPR-13 |
| **Kasir** — denah meja real-time Kosong (hijau) / Terisi (amber) per lantai | KSR-03…KSR-07 |
| Kasir — konfirmasi pembayaran tunai pelanggan | KSR-12…KSR-16 |
| Kasir — input walk-in / takeaway | KSR-08…KSR-11 |
| Kasir — cetak struk thermal | KSR-17…KSR-21 |
| **Owner** — metrik omset, jumlah & rata-rata transaksi, produk terlaris | OWN-02…OWN-06 |
| Owner — grafik interaktif | OWN-07, OWN-08 |
| Owner — kelola stok produk jadi | OWN-10…OWN-13 |
| Owner — stok berkurang otomatis saat dibeli | OWN-14, INT-01 |
| Owner — kunci menu "HABIS" saat stok 0 | OWN-15, OWN-16, PLG-09, KSR-10 |
| Owner — riwayat transaksi | OWN-17 |
| Owner — ekspor CSV/Excel | OWN-18, OWN-19, OWN-20 |
| **Alur kerja utama** (Pelanggan ➔ Dapur ➔ Kasir ➔ Owner) | INT-01, INT-02 |
| **Fitur kunci** — lokasi meja & lantai (L1, L2, Rooftop, Takeaway) | KSR-03, KSR-22…KSR-24, PLG-04, DPR-07 |
| Fitur kunci — QRIS simulation & cash | PLG-14, PLG-15, KSR-12…16 |
| Fitur kunci — stok real-time + peringatan < 5 + habis otomatis | OWN-10…16, INT-03 |
| Fitur kunci — struk thermal & e-receipt | KSR-17…21, PLG-16 |
| Fitur kunci — anti pesanan ganda (submit lock + dedup ID) | PLG-20…PLG-22, KSR-25, KSR-16, INT-04 |
| **Lanjutan** — payment gateway asli (Midtrans/Xendit) | ADV-PG-01…08 |
| Lanjutan — login & keamanan role | SEC-01…SEC-12 |
| Lanjutan — QR Code halaman customer | ADV-QR-01…05 |

---

## 3. Pelanggan (Customer Self-Service)

Halaman: `/order/<id-meja>` (tanpa login).

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| PLG-01 | Scan QR meja valid | Scan QR Meja 3 Lantai 1 dengan kamera HP | Halaman menu terbuka; meja & lantai sudah terisi "Meja 3 · Lantai 1"; tidak perlu unduh aplikasi | P1 |
| PLG-02 | QR meja tidak dikenali | Buka `/order/meja-tidak-ada` | Muncul pesan "QR meja tidak dikenali. Silakan pilih lantai dan meja Anda." dan pemilih lantai & meja terbuka | P2 |
| PLG-03 | Buka tanpa ID meja | Buka `/order` | Pelanggan diminta memilih lantai & meja sebelum checkout | P2 |
| PLG-04 | Pilih lantai & meja | Buka "Pilih lantai & meja", pilih Rooftop ➔ meja tertentu | Hanya meja di lantai terpilih yang tampil; pilihan tersimpan di header | P1 |
| PLG-05 | Ganti meja sebelum pesan | Ganti dari Lantai 1 ke Lantai 2 | Keranjang tidak hilang; pesanan dikirim dengan meja baru | P2 |
| PLG-06 | Checkout tanpa meja | Kosongkan meja lalu tekan bayar | Ditolak dengan "Pilih lantai dan meja terlebih dahulu" | P1 |
| PLG-07 | Tambah menu ke keranjang | Tambah Produk A ×2, Produk C ×1 | Bar keranjang menampilkan jumlah item & total benar | P1 |
| PLG-08 | Ubah/hapus jumlah | Naik/turunkan qty, turunkan hingga 0 | Total ikut berubah; item hilang saat qty 0 | P2 |
| PLG-09 | Menu HABIS terkunci | Lihat Produk D (stok 0) | Badge **HABIS**, tidak bisa ditambahkan | P1 |
| PLG-10 | Qty melebihi stok | Produk A stok 6, coba tambah 7 | Tidak bisa melebihi 6, atau ditolak saat kirim dengan pesan stok tidak cukup; tidak ada pesanan parsial | P1 |
| PLG-11 | Catatan khusus | Isi catatan "pedas, tanpa es" pada item | Catatan tersimpan per item dan terlihat di keranjang | P1 |
| PLG-12 | Pesan & bayar tunai di kasir | Tekan "Pesan & Bayar Tunai di Kasir" | Toast "Pesanan #N diterima dapur!"; instruksi "Bayar tunai di kasir: sebutkan #N"; status bayar **Belum Bayar** | P1 |
| PLG-13 | Status setelah kasir menerima tunai | Setelah KSR-12 selesai, lihat status di HP | Muncul "Pembayaran diterima" dan tombol "Struk digital" ≤ 10 detik | P1 |
| PLG-14 | Bayar QRIS (demo) **[L]** | Tekan "Bayar Sekarang via QRIS (demo)" ➔ konfirmasi simulasi | Modal "Simulasi QRIS (mode demo lokal)"; setelah konfirmasi: "Pesanan #N lunas (simulasi QRIS demo)" | P1 |
| PLG-15 | QRIS tidak tersedia **[R]** | `MIDTRANS_SERVER_KEY` kosong | Tombol QRIS tidak tersedia / "QRIS belum tersedia. Silakan bayar di kasir."; pesanan tetap diproses dapur | P1 |
| PLG-16 | Struk digital (e-receipt) | Setelah lunas, buka "Struk digital", simpan | Struk memuat nama toko, no. pesanan, meja/lantai, item+catatan, subtotal, pajak/layanan, total, metode bayar, waktu; bisa disimpan | P1 |
| PLG-17 | Progres: Diterima Dapur | Kirim pesanan, lihat kartu status | Status **Diterima Dapur** | P1 |
| PLG-18 | Progres: Sedang Dimasak & Siap Diantar | Dapur menekan "Mulai masak", lalu "Selesai & siap" | HP berubah ke **Sedang Dimasak**, lalu **Siap Diantar** + banner "Pesanan Anda siap dan sedang diantar ke meja." ≤ 10 detik | P1 |
| PLG-19 | Lacak setelah refresh/tutup tab | Refresh halaman / tutup lalu buka lagi | Pesanan aktif tetap terlacak di perangkat yang sama | P2 |
| PLG-20 | Submit lock (double tap) | Tekan tombol kirim 5× cepat | Tombol terkunci selama proses; hanya **1** pesanan tercipta (cek di Dapur & Kasir) | P1 |
| PLG-21 | Koneksi putus saat kirim **[R]** | Matikan jaringan tepat setelah tekan kirim, nyalakan lagi, tekan "Kirim ulang" | Pemberitahuan pesanan tertunda muncul; kirim ulang menghasilkan pesanan **yang sama** (no. sama), tidak dobel | P1 |
| PLG-22 | Back/refresh setelah sukses | Tekan back lalu forward/refresh setelah pesanan sukses | Tidak ada pesanan kedua | P2 |
| PLG-23 | Privasi status pesanan **[R]** | Salin URL status/struk ke perangkat lain tanpa kunci; ubah nomor pesanan | Tidak bisa melihat pesanan orang lain (ditolak/404) | P1 |
| PLG-24 | Pelanggan tidak bisa buka menu staf | Dari HP pelanggan buka `/`, `/dapur`, `/laporan` | Diminta login / akses ditolak (lihat SEC-01) | P1 |
| PLG-25 | Tampilan HP | Uji di layar 360 px dan iPhone | Tidak ada elemen terpotong; tombol ≥ 44 px; bisa dipakai satu tangan | P2 |

---

## 4. Dapur (Kitchen Display System)

Halaman: `/dapur`, login role `dapur`.

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| DPR-01 | Masuk ke KDS | Login sebagai dapur | Langsung diarahkan ke `/dapur`; judul "Layar Dapur (KDS)" | P1 |
| DPR-02 | Aktifkan bel | Tekan "Aktifkan bel" | Label berubah "Bel aktif"; toast "Bel pesanan masuk aktif" | P1 |
| DPR-03 | Bunyi bel pesanan baru | Pelanggan/kasir kirim pesanan baru | Bel berbunyi + toast "Pesanan baru #N · Meja" ≤ 10 detik | P1 |
| DPR-04 | Kartu pesanan otomatis | Kirim pesanan dari self-order, POS, dan pelayan | Tiket muncul tanpa refresh; label asal "QR Self-Order", "Kasir POS", "Pelayan: nama" | P1 |
| DPR-05 | Urutan FIFO | Kirim 3 pesanan berurutan | Tiket berurutan dari paling awal ("Urutan ke-1, 2, 3") | P2 |
| DPR-06 | Detail menu & porsi | Lihat tiket pesanan berisi 3 item | Nama menu dan jumlah porsi sesuai pesanan | P1 |
| DPR-07 | Meja & lantai / Takeaway | Bandingkan pesanan Meja 2 Rooftop dan takeaway | Tiket menampilkan "Meja 2 · Rooftop"; takeaway tampil "Takeaway" | P1 |
| DPR-08 | Catatan & status bayar | Pesanan dengan catatan, satu lunas satu tunai | Catatan pelanggan tampil per item; badge **LUNAS** / **BELUM BAYAR** sesuai | P1 |
| DPR-09 | Diterima ➔ Dimasak | Tekan "Mulai masak" | Tiket pindah ke filter "Dimasak"; toast "Pesanan #N mulai dimasak"; HP pelanggan berubah (PLG-18) | P1 |
| DPR-10 | Dimasak ➔ Selesai & Ready | Tekan "Selesai & siap" | Tiket pindah ke "Siap"; toast "selesai dan siap diantar" | P1 |
| DPR-11 | Ready ➔ Sudah diantar | Tekan "Sudah diantar ke tamu" | Tiket hilang dari antrean aktif | P2 |
| DPR-12 | Status bayar tidak berubah oleh dapur | Pesanan Belum Bayar diproses sampai diantar | Status bayar tetap **Belum Bayar**; meja tetap **Terisi** di kasir | P1 |
| DPR-13 | Status bayar berubah saat dimasak | Kasir menerima bayar saat tiket "Dimasak" | Badge berubah ke **LUNAS** ≤ 10 detik tanpa mengubah status masak | P1 |
| DPR-14 | Filter tiket | Pilih Semua / Diterima / Dimasak / Siap | Jumlah di filter sesuai jumlah tiket | P2 |
| DPR-15 | Timer & prioritas | Biarkan tiket > 15 menit | Timer menit berjalan; tanda "Prioritas!" muncul | P2 |
| DPR-16 | Antrean kosong | Selesaikan semua tiket | Tampil "Tidak ada tiket masak aktif" | P3 |
| DPR-17 | Dua tablet dapur **[R]** | Tablet A menekan "Mulai masak" | Tablet B ikut berubah ≤ 10 detik; tidak ada konflik | P2 |
| DPR-18 | Batas akses dapur | Sebagai dapur buka `/`, `/laporan`, `/produk` | Halaman terkunci; tombol kembali ke `/dapur` | P1 |

---

## 5. Kasir (Point of Sale)

Halaman: `/` (POS), `/meja`, `/pesanan`, `/laci-kas`, login role `kasir`/`admin`.

### 5.1 Shift & denah meja

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| KSR-01 | Buka shift | Laci Kas ➔ Buka shift, modal awal Rp 200.000 | Shift aktif; nama kasir & modal tercatat | P1 |
| KSR-02 | Tunai tanpa shift | Tutup shift, coba bayar tunai | Ditolak: "Buka shift di Laci Kas untuk menerima tunai" | P1 |
| KSR-03 | Denah meja per lantai | Buka `/meja`, pilih filter Lantai 1 / Lantai 2 / Rooftop / Semua | Hanya meja lantai terpilih tampil; ringkasan "X kosong · Y terisi" benar | P1 |
| KSR-04 | Meja kosong = hijau | Meja tanpa pesanan aktif | Kartu hijau, badge "Kosong" | P1 |
| KSR-05 | Meja terisi = amber real-time | Pelanggan pesan dari Meja 4 | Meja 4 berubah amber "Terisi" ≤ 10 detik tanpa refresh | P1 |
| KSR-06 | Meja kembali kosong | Pesanan Meja 4 sudah **lunas dan diantar** | Meja 4 kembali hijau | P1 |
| KSR-07 | Meja tetap terisi | Pesanan diantar tapi belum bayar, ATAU lunas tapi belum diantar | Meja tetap amber | P1 |

### 5.2 Input walk-in / takeaway

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| KSR-08 | Takeaway bayar tunai | Pilih "Bawa pulang", tambah menu, bayar tunai Rp 100.000 | Kembalian benar; pesanan lunas; tiket dapur "Takeaway" | P1 |
| KSR-09 | Walk-in makan di tempat | Pilih meja, tambah menu + catatan, "Kirim ke Dapur" (bayar nanti) | Tiket dapur muncul **BELUM BAYAR**; meja jadi Terisi | P1 |
| KSR-10 | Menu HABIS di POS | Produk D stok 0 | Kartu produk terkunci "HABIS" | P1 |
| KSR-11 | Hitungan harga | Pesanan dengan diskon %, service, PPN | Subtotal, diskon, service, pajak, total sesuai rumus & sama dengan struk/server | P1 |

### 5.3 Konfirmasi pembayaran tunai

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| KSR-12 | Terima tunai pesanan self-order | `/pesanan`, cari #N (dari PLG-12), "Terima Bayar", tunai | Status **Lunas · Tunai**; tidak membuat pesanan baru; HP pelanggan update (PLG-13); dapur update (DPR-13) | P1 |
| KSR-13 | Uang kurang | Input nominal < total | Ditolak: "Uang tunai masih kurang" | P1 |
| KSR-14 | Tombol uang cepat | Pakai "Uang pas" & pembulatan | Nominal & kembalian benar | P3 |
| KSR-15 | Masuk laci kas | Cek Laci Kas setelah KSR-12 | Penerimaan tunai bertambah sesuai total | P2 |
| KSR-16 | Bayar ganda dicegah | Dua kasir menekan "Terima Bayar" pesanan sama | Kedua dapat respons; yang kedua "Pesanan #N sudah lunas sebelumnya"; laci kas hanya bertambah **sekali** | P1 |

### 5.4 Struk thermal

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| KSR-17 | Cetak via browser | "Cetak struk" ➔ dialog print | Pratinjau lebar thermal; isi lengkap; tidak terpotong | P1 |
| KSR-18 | Cetak Bluetooth ESC/POS | Pengaturan ➔ Printer, sambungkan; cetak | Struk tercetak pada kertas 58 mm dan 80 mm, rata & terbaca | P1 |
| KSR-19 | Isi struk | Periksa hasil cetak | Header toko, no. pesanan, meja/lantai atau "BAWA PULANG", item + catatan, diskon/pajak/service, total, metode, tunai & kembalian, kasir, waktu, footer | P1 |
| KSR-20 | Cetak ulang dari Pesanan | `/pesanan` ➔ "Cetak" pesanan lama | Struk sama dengan aslinya | P2 |
| KSR-21 | Printer gagal | Matikan printer, cetak | Pesan "Struk gagal dicetak."; transaksi tetap tersimpan | P2 |

### 5.5 Manajemen meja & lantai

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| KSR-22 | Tambah meja per lantai | Tambah "Meja 9" lantai "Rooftop" | Meja muncul di filter Rooftop dan di pilihan pelanggan | P2 |
| KSR-23 | Hapus meja yang terpakai | Hapus meja yang punya pesanan aktif/belum bayar | Ditolak | P1 |
| KSR-24 | Cetak QR meja | "Cetak QR Rooftop" / per meja | QR tercetak; scan membuka `/order/<id-meja>` yang benar | P1 |
| KSR-25 | Submit lock POS | Klik "Bayar & Kirim ke Dapur" berkali-kali cepat | Hanya 1 pesanan & 1 pembayaran tercatat | P1 |

---

## 6. Owner / Manajer Dashboard

Halaman: `/laporan`, `/produk`, login role `manajer` (juga uji dengan `admin`).

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| OWN-01 | Masuk dashboard | Login manajer | Langsung ke `/laporan` "Dashboard Owner" | P1 |
| OWN-02 | Total omset | Bandingkan dengan jumlah total pesanan **lunas** di periode | Sama persis; pesanan belum bayar **tidak** dihitung | P1 |
| OWN-03 | Jumlah transaksi | Hitung manual pesanan lunas | Sama | P1 |
| OWN-04 | Rata-rata transaksi | Omset ÷ jumlah transaksi | Sama (pembulatan rupiah konsisten) | P1 |
| OWN-05 | Produk terlaris | Hitung porsi terjual per produk | Urutan & "X porsi · Rp" benar | P1 |
| OWN-06 | Metrik real-time | Buka dashboard, kasir menerima pembayaran baru | Metrik bertambah ≤ 10 detik (atau via "Muat ulang laporan") | P1 |
| OWN-07 | Grafik interaktif | Hover/tap batang grafik | Tooltip "label — Rp · N transaksi" benar | P2 |
| OWN-08 | Periode | Hari ini, 7 hari, 30 hari, Bulan ini, Pilih tanggal | Grafik per jam (hari ini) / per hari; angka sesuai periode | P1 |
| OWN-09 | Periode kosong | Pilih tanggal tanpa transaksi | "Belum ada penjualan pada periode ini" | P3 |
| OWN-10 | Atur stok | `/produk` ➔ Atur stok Produk A = 6 | Tersimpan; "Stok 6" | P1 |
| OWN-11 | Peringatan stok menipis | Ubah stok ke 4 | Peringatan "menu stok menipis (< 5 porsi)"; muncul di "Sisa stok produk jadi" | P1 |
| OWN-12 | Stok tidak boleh negatif | Kurangi melebihi sisa | "Stok menjadi: tidak boleh negatif"; tidak bisa simpan | P1 |
| OWN-13 | Berhenti lacak | "Berhenti lacak" pada produk | "Tidak dilacak", selalu tersedia | P2 |
| OWN-14 | Stok berkurang otomatis | Pelanggan beli Produk A ×2 | Stok 6 ➔ 4 ≤ 10 detik | P1 |
| OWN-15 | HABIS otomatis | Beli sisa stok hingga 0 | Badge **HABIS**; "menu HABIS (terkunci di menu pelanggan & kasir)" | P1 |
| OWN-16 | Buka kunci HABIS | Tambah stok 10 | Menu bisa dipesan lagi di HP pelanggan & POS | P1 |
| OWN-17 | Riwayat transaksi | Lihat tabel riwayat | Kolom No, Dibayar, Meja, Metode, Kasir, Item, Total benar & lengkap | P1 |
| OWN-18 | Ekspor CSV | Klik "CSV" | File terunduh; buka di Excel: kolom terbaca, angka & tanggal benar, karakter Indonesia tidak rusak | P1 |
| OWN-19 | Ekspor Excel | Klik "Excel" | File `.xlsx` terbuka tanpa error; isi = tabel riwayat periode terpilih | P1 |
| OWN-20 | Cetak / PDF | Klik "Cetak / PDF" | Laporan tercetak rapi | P3 |
| OWN-21 | Batas akses owner | Sebagai manajer buka `/` (POS) dan `/dapur`; coba ubah harga, diskon, "Terima Bayar" | Halaman terkunci / tombol tersembunyi; aksi ditolak "akses ditolak" | P1 |
| OWN-22 | Owner hanya lihat Pesanan & Meja | `/pesanan`, `/meja` | Bisa melihat, tidak bisa melunasi/mengubah | P2 |

---

## 7. Integrasi Lintas Peran (Alur Kerja Utama)

Jalankan di mode **remote** dengan 4 perangkat terpisah secara bersamaan.

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| INT-01 | Alur penuh — tunai di kasir | 1) Pelanggan scan QR Meja 2 Lantai 2, pesan Produk A ×2 + catatan, pilih tunai. 2) Dapur: bel, "Mulai masak", "Selesai & siap", "Sudah diantar". 3) Kasir: meja amber ➔ "Terima Bayar" tunai ➔ cetak struk. 4) Owner cek dashboard | Setiap langkah tersinkron ≤ 10 detik; stok A turun 2 saat pesanan dibuat; meja hijau setelah lunas+diantar; omset & transaksi bertambah sekali; muncul di riwayat & CSV | P1 |
| INT-02 | Alur penuh — QRIS mandiri | Seperti INT-01, bayar QRIS (demo atau Midtrans sandbox) | Tiket dapur langsung **LUNAS**; pelanggan dapat struk digital; kasir tidak perlu konfirmasi; omset bertambah | P1 |
| INT-03 | Balapan stok terakhir **[R]** | Produk B stok 1; 2 HP pelanggan menekan kirim bersamaan | Hanya 1 pesanan berhasil; yang lain ditolak utuh (tanpa pesanan parsial); stok = 0 (tidak negatif); menu jadi HABIS | P1 |
| INT-04 | Dedup lintas perangkat | Ulangi PLG-20/21 sambil memantau dapur & kasir | Hanya 1 tiket dapur dan 1 baris di riwayat | P1 |
| INT-05 | Pesanan pelayan dilunasi kasir | Pelayan input pesanan meja (bayar nanti) ➔ kasir "Terima Bayar" | Pesanan sama yang dilunasi (no. tidak berubah) | P2 |
| INT-06 | Tutup shift & rekonsiliasi | Kasir tutup shift dengan hitungan fisik | Selisih (pas/surplus/minus) dihitung benar dari total tunai INT-01 dll. | P2 |

---

## 8. Keamanan & Akses Role (Pengembangan Lanjutan: Login & Keamanan Role)

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| SEC-01 | Pelanggan tak bisa akses tab staf **[R]** | Tanpa login buka `/`, `/dapur`, `/pesanan`, `/laporan` | Halaman login; data staf tidak termuat | P1 |
| SEC-02 | Login benar **[R]** | Login dengan username/password tiap role | Masuk ke halaman default role (kasir `/`, dapur `/dapur`, manajer `/laporan`, pelayan `/pelayan`) | P1 |
| SEC-03 | Login salah | Password/PIN salah | Ditolak, pesan jelas, tidak membocorkan apakah username ada | P1 |
| SEC-04 | Throttle login **[R]** | Salah password 6× untuk user sama | Diblokir: "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit." (HTTP 429) | P1 |
| SEC-05 | Logout | Logout lalu tekan Back | Tidak bisa kembali ke halaman staf | P1 |
| SEC-06 | Sesi kedaluwarsa **[R]** | Sesi > 12 jam (atau hapus sesi di D1) | Diminta login ulang | P2 |
| SEC-07 | Ganti staf PIN **[L]** | Quick Switch dengan PIN benar/salah | PIN benar masuk; salah ditolak | P2 |
| SEC-08 | Matriks akses halaman | Tiap role buka semua rute (tabel di bawah) | Sesuai matriks | P1 |
| SEC-09 | Bypass UI via API **[R]** | Dengan cookie role `dapur`/`manajer` panggil `POST /api/orders/{no}/payment`, ubah produk | HTTP 403; data tidak berubah | P1 |
| SEC-10 | Manipulasi harga dari klien **[R]** | Kirim pesanan dengan harga/total diubah di request | Server menghitung ulang dari harga katalog | P1 |
| SEC-11 | Self-order dengan produk HABIS via API **[R]** | Kirim langsung item stok 0 | Ditolak | P1 |
| SEC-12 | Isolasi data pelanggan **[R]** | Lihat PLG-23 | Status/struk tidak terbaca tanpa kunci perangkat | P1 |

Matriks akses halaman (✔ = boleh, ✖ = terkunci):

| Rute | admin | kasir | manajer | dapur | pelayan | tanpa login |
|---|---|---|---|---|---|---|
| `/order/<meja>` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `/` POS | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| `/pesanan` | ✔ | ✔ | ✔ (lihat) | ✖ | ✖ | ✖ |
| `/meja` | ✔ | ✔ | ✔ (lihat) | ✖ | ✖ | ✖ |
| `/produk` | ✔ | ✔ | ✔ (stok saja) | ✖ | ✖ | ✖ |
| `/laporan` | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| `/laci-kas` | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| `/pengaturan` | ✔ | ✔ | ✔ (pajak lihat) | ✖ | ✖ | ✖ |
| `/dapur` | ✔ | ✔ | ✖ | ✔ | ✖ | ✖ |
| `/pelayan` | ✔ | ✔ | ✖ | ✖ | ✔ | ✖ |

---

## 9. Pengembangan Lanjutan

### 9.1 Payment gateway asli (Midtrans) — **[R]**, sandbox

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| ADV-PG-01 | QR dinamis dibuat | Pelanggan pilih "Bayar Sekarang via QRIS" | QR tampil dengan nominal = total; "Berlaku sampai …" (15 menit) | P1 |
| ADV-PG-02 | Lunas otomatis | Bayar via simulator Midtrans sandbox | Pesanan **Lunas** otomatis tanpa klik kasir; HP: "Pembayaran QRIS pesanan #N diterima!"; dapur LUNAS | P1 |
| ADV-PG-03 | Webhook signature palsu | Kirim notifikasi ke `/api/payments/midtrans/notify` dengan signature salah | Ditolak; pesanan tetap Belum Bayar | P1 |
| ADV-PG-04 | Nominal tidak cocok | Notifikasi valid tapi gross amount beda | Tidak dilunasi | P1 |
| ADV-PG-05 | Status bukan settlement | Notifikasi `pending`/`expire`/`deny` | Tidak dilunasi | P1 |
| ADV-PG-06 | Webhook ganda | Kirim notifikasi settlement 2× | Lunas sekali; omset tidak dobel | P1 |
| ADV-PG-07 | QR kedaluwarsa | Tunggu > 15 menit | QR baru dibuat otomatis; QR lama tidak bisa melunasi | P2 |
| ADV-PG-08 | Gateway down | Arahkan `MIDTRANS_API_BASE` ke alamat mati | "QRIS belum tersedia. Silakan bayar di kasir."; pesanan tetap ke dapur | P2 |

### 9.2 QR Code halaman customer

| ID | Skenario | Langkah | Hasil yang diharapkan | Prio |
|---|---|---|---|---|
| ADV-QR-01 | QR per meja | Buka QR tiap meja di `/meja` | Setiap QR berisi `/order/<id-meja>` yang unik & benar | P1 |
| ADV-QR-02 | Scan dari kertas cetak | Cetak, tempel, scan dari jarak 20–40 cm dengan 2 merek HP | Terbaca dalam < 3 detik | P1 |
| ADV-QR-03 | Domain QR | Cek host di QR (produksi/staging) | Mengarah ke domain publik yang bisa diakses HP pelanggan, bukan `localhost` | P1 |
| ADV-QR-04 | QR tetap valid setelah ubah meja | Ganti nama/lantai meja | QR lama tetap membuka meja yang sama (ID stabil) | P2 |
| ADV-QR-05 | Salin tautan QR | "Salin tautan" | Toast "Tautan QR meja disalin ke clipboard"; tautan bekerja | P3 |

---

## 10. Non-Fungsional

| ID | Skenario | Hasil yang diharapkan | Prio |
|---|---|---|---|
| NFR-01 | Latensi sinkronisasi (4 perangkat) | Perubahan tampil ≤ 10 detik di semua perangkat | P1 |
| NFR-02 | Beban jam sibuk **[R]** | 20 pesanan dalam 5 menit dari 5 HP: tidak ada yang hilang/dobel, nomor pesanan unik | P1 |
| NFR-03 | Koneksi lemah | Throttle jaringan "Slow 3G": pesanan tetap terkirim atau ada pesan jelas + kirim ulang aman | P2 |
| NFR-04 | Kompatibilitas browser | Chrome Android, Safari iOS (pelanggan); Chrome/Edge desktop (staf, Bluetooth) | P1 |
| NFR-05 | Responsif | Pelanggan 360–430 px; kasir HP/tablet (< 1200 px) & desktop; dapur tablet landscape | P2 |
| NFR-06 | Aksesibilitas dasar | Status tidak hanya dibedakan warna (ada teks "Kosong/Terisi", "LUNAS/BELUM BAYAR"); tombol ≥ 44 px | P2 |
| NFR-07 | Reset demo **[L]** | Reset menghapus data & memuat ulang semua tab | P3 |

---

## 11. Lembar Eksekusi & Kriteria Rilis

### 11.1 Format pencatatan

| ID | Tanggal | Penguji | Mode | Perangkat/Browser | Hasil | No. pesanan / bukti | Catatan |
|---|---|---|---|---|---|---|---|
| PLG-01 | | | | | | | |

### 11.2 Format laporan bug

```text
Judul      : [ID kasus] ringkasan singkat
Peran      : Pelanggan / Dapur / Kasir / Owner
Mode       : Demo lokal / Remote (URL)
Perangkat  : model, OS, browser + versi
Langkah    : 1. … 2. … 3. …
Diharapkan : …
Aktual     : …
Bukti      : tangkapan layar / video, no. pesanan, jam
Prioritas  : P1 / P2 / P3
```

### 11.3 Kriteria lulus rilis

- 100% kasus **P1** `LULUS` di mode remote.
- ≥ 90% kasus **P2** `LULUS`; sisanya punya rencana perbaikan.
- Tidak ada temuan terbuka pada: omset/total salah, pesanan ganda, stok negatif, pelunasan ganda, akses role bocor.
- INT-01 dan INT-02 lulus 3× berturut-turut dengan 4 perangkat fisik.

### 11.4 Uji otomatis pendukung

Jalankan sebelum UAT; hasilnya tidak menggantikan uji manual perangkat fisik (bel, printer, kamera).

```bash
pnpm test        # unit & aturan server: harga, auth, pesanan, pembayaran, kas
pnpm test:e2e    # Playwright: shift kasir, dapur, pemulihan self-order, mode demo
pnpm test:uat    # Playwright: seluruh kasus skema ini per peran (apps/e2e/uat); hasil di docs/HASIL-PENGUJIAN.md
```
