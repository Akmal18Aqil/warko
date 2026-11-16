export const app = {
  name: "WAKRO Digital",
  tagline: "SISTEM KASIR",
  station: "Kasir depan · Mesin 01",
  controlSection: "Kontrol",

  nav: {
    newPos: "Pesanan baru",
    orders: "Pesanan",
    tables: "Meja",
    products: "Produk",
    reports: "Laporan",
    settings: "Pengaturan",
    waiterOrders: "Pesanan Pelayan",
    waiterShort: "Pelayan",
    kitchen: "Dapur (KDS)",
    kitchenShort: "Dapur",
    cashDrawer: "Laci Kas",
    mainLabel: "Navigasi utama",
  },

  header: {
    readyTitle: "Siap menerima pesanan.",
    allSaved: "Semua perubahan tersimpan",
    notifications: "Notifikasi",
    noNotifications: "Tidak ada notifikasi baru",
    localServer: "Server Lokal:",
    networkTitle: "Buka Pusat Jaringan & Pairing HP Pelayan",
    pairPhone: "Pair HP",
    accountMenu: (name: string) => `Menu akun ${name}`,
    manageStaff: "Kelola akun staf",
    logout: "Keluar / ganti akun",
    /** Computed when rendered, so a tab left open overnight shows the right day. */
    today: (date: Date) =>
      new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        .format(date)
        .toUpperCase(),
  },

  auth: {
    wrongPin: "PIN salah! Silakan coba lagi.",
    loginSuccess: (name: string, title: string) => `Login berhasil: ${name} (${title})`,
    switchedTo: (name: string, title: string) => `Beralih ke: ${name} (${title})`,
  },

  sidebar: {
    collapse: "Ciutkan sidebar",
    expand: "Perluas sidebar",
    switchStaff: "Klik untuk ganti peran atau masuk staf lain",
    switchRole: "Ganti Peran",
    switchShort: "Ganti",
    pin: "PIN",
  },

  focus: {
    waiter: "Pelayan Focus",
    kitchen: "Dapur KDS Focus",
    defaultSubtitle: "Modul Khusus Staf · Bebas Distraksi",
    networkTitle: "Pusat Jaringan & Server Lokal",
    fullscreenExit: "Keluar Layar Penuh",
    fullscreenEnter: "Layar Penuh (Kiosk)",
    toPos: "Ke POS Kasir",
    toPosTitle: "Kembali ke Layar POS Kasir",
    switchStaffTitle: "Klik untuk ganti akun staf / PIN",
    pin: "PIN",
  },

  routes: {
    pos: "POS Kasir Utama",
    cashDrawer: "Laci Kas & Rekonsiliasi",
    orders: "Daftar Pesanan",
    tables: "Manajemen Meja",
    products: "Katalog & Produk",
    reports: "Laporan Penjualan",
    settings: "Pengaturan Sistem",
    waiter: "Mode Pelayan",
    kitchen: "Layar Dapur (KDS)",
  },

  guard: {
    pageTitle: "Akses Dibatasi",
    defaultModule: "Modul ini",
    lockedTitle: "Akses Terkunci untuk Peran Ini",
    body: (moduleName: string) => `Halaman ${moduleName} dikhususkan untuk Kasir atau Manajer. Profil aktif saat ini adalah:`,
    switchStaff: "Ganti Staf / Masukkan PIN Kasir",
    backTo: (title: string) => `Kembali ke Modul ${title}`,
  },

  quickSwitch: {
    remoteTitle: (name: string) => `Akun ${name}`,
    remoteBody: "Keluar untuk masuk menggunakan akun staf lain.",
    title: "Ganti Peran & Masuk Staf",
    subtitle: "Pilih profil staf dan masukkan PIN 4 digit untuk akses modul khusus",
    stepSelect: "1. Pilih Akun Staf:",
    activeNow: "Aktif saat ini:",
    active: "Aktif",
    enterPinFor: "Masukkan PIN untuk",
    pinMismatch: "PIN tidak sesuai!",
    clear: "Hapus",
    deleteDigit: "Hapus Satu Digit",
    digit: (d: string) => `Angka ${d}`,
    quickSwitch: "Pintas Cepat (Tanpa Ketik PIN):",
  },

  remoteGate: {
    unreachable: "Server tidak dapat dijangkau.",
    logoutFailed: "Gagal keluar. Coba lagi.",
    badCredentials: "Nama pengguna atau kata sandi tidak benar.",
    sessionFailed: "Sesi tidak dapat dibuka.",
    title: "Masuk staf",
    username: "Nama pengguna",
    password: "Kata sandi",
    submit: "Masuk",
    submitting: "Memuat…",
  },

  layout: {
    loadingPage: "Memuat halaman…",
  },
} as const;
