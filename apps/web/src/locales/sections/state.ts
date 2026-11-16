/** User-facing text produced by the state layer (toasts and thrown errors). */
export const state = {
  cartEmpty: "Keranjang masih kosong.",
  pickTableFirst: "Pilih meja terlebih dahulu.",
  orderStillProcessing: "Pesanan sebelumnya masih diproses.",
  tableNotFound: "Meja tidak ditemukan. Muat ulang daftar meja.",
  publicPayLater: "Pembayaran dilakukan di kasir atau lewat QRIS setelah pesanan dibuat.",
  noActiveShift: "Tidak ada shift yang sedang aktif.",
  newCategoryName: "Kategori Baru",
  defaultCustomer: "Pelanggan Meja",
  defaultGuest: "Tamu Meja",
  serverUnreachable: "Server data tidak dapat dijangkau. Periksa koneksi dan masuk kembali.",
  localDbFailed: "Database browser tidak dapat dibuka. Muat ulang halaman.",
} as const;
