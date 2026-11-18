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
    more: "Lainnya",
    moreTitle: "Menu lainnya",
  },

  header: {
    readyTitle: "Siap menerima pesanan.",
    allSaved: "Semua perubahan tersimpan",
    notifications: "Notifikasi",
    noNotifications: "Tidak ada notifikasi baru",
    localServer: "Server Lokal:",
    networkTitle: "Buka Pusat Jaringan & Pairing HP Pelayan",
    pairPhone: "Pair HP",
    demoBadge: "Mode Demo",
    demoBadgeTitle: "Mode Demo: data hanya di browser ini. Buka info sinkronisasi tab",
    accountMenu: (name: string) => `Menu akun ${name}`,
    manageStaff: "Kelola akun staf",
    logout: "Keluar",
    lock: "Kunci layar",
    switchUser: "Ganti pengguna",
    /** Computed when rendered, so a tab left open overnight shows the right day. */
    today: (date: Date) =>
      new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date).toUpperCase(),
  },

  demo: {
    label: "DEMO",
    banner: "Data contoh tersimpan hanya di browser ini dan tidak dikirim ke server.",
    reset: "Reset demo",
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
    body: (moduleName: string) => `Halaman ${moduleName} tidak tersedia untuk peran Anda. Profil aktif saat ini adalah:`,
    switchStaff: "Ganti Staf / Masukkan PIN",
    backTo: (title: string) => `Kembali ke Modul ${title}`,
  },

  quickSwitch: {
    title: "Ganti Peran & Masuk Staf",
    subtitle: "Pilih profil staf dan masukkan PIN 4 digit untuk akses modul khusus",
    subtitleDemo: "Mode demo: PIN setiap staf tertera di kartunya. Ketuk kartu lalu masukkan PIN, atau pakai pintasan di bawah.",
    demoPin: (pin: string) => `PIN demo: ${pin}`,
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
    sessionEnded: "Sesi berakhir. Silakan masuk kembali.",
    title: "Masuk staf",
    username: "Nama pengguna",
    password: "Kata sandi",
    submit: "Masuk",
    submitting: "Memuat…",
    passwordIntro: "Masuk dengan nama pengguna dan kata sandi.",
    deviceHint: "Perangkat ini terdaftar. Staf cukup memakai PIN untuk masuk.",
    usePin: "Masuk dengan PIN",
    deviceRevoked: "Perangkat ini tidak lagi terdaftar. Masuk dengan kata sandi, lalu minta admin mendaftarkannya kembali.",
    pinTitle: "Masukkan PIN",
    pinIntro: (deviceName: string) => `Perangkat terdaftar: ${deviceName}`,
    forgotPin: "Lupa PIN atau PIN tidak diterima?",
    usePassword: "Masuk dengan kata sandi",
    forgotPinHelp: "Masuk dengan kata sandi, lalu minta admin mengatur ulang PIN di Pengaturan.",
    checkingSession: "Memeriksa sesi…",
  },

  pin: {
    chooseStaff: "Pilih akun staf",
    chooseStaffFirst: "Pilih akun staf terlebih dahulu.",
    noStaffWithPin: "Belum ada staf yang memiliki PIN. Masuk dengan kata sandi, lalu minta admin mengatur PIN staf di Pengaturan.",
    dotsLabel: (filled: number, total: number) => `${filled} dari ${total} digit PIN terisi`,
    digit: (d: string) => `Angka ${d}`,
    clear: "Hapus",
    deleteDigit: "Hapus satu digit",
    checking: "Memeriksa PIN…",
    waitFor: (seconds: number) => {
      const minutes = Math.ceil(seconds / 60);
      return seconds >= 60 ? `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.` : `Terlalu banyak percobaan. Coba lagi dalam ${seconds} detik.`;
    },
  },

  remoteSwitch: {
    title: "Ganti pengguna",
    subtitle: "Pilih akun staf dan masukkan PIN 6 digit. Sesi akun saat ini berakhir.",
    lockHint: "Kunci layar tanpa keluar dari perangkat ini.",
    lock: "Kunci layar",
    unregisteredTitle: (name: string) => `Akun ${name}`,
    unregisteredBody: "Perangkat ini belum terdaftar untuk masuk dengan PIN. Keluar untuk masuk dengan akun staf lain.",
    adminRegisterHint: "Admin dapat mendaftarkan perangkat ini di Pengaturan > Perangkat PIN.",
    openSettings: "Buka Pengaturan",
    loadingStaff: "Memuat daftar staf…",
  },

  layout: {
    loadingPage: "Memuat halaman…",
  },
} as const;
