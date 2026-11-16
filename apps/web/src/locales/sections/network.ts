/** Text of the network hub and the local-server guide. `**bold**` marks emphasis inside guide prose. */
const EDIT_IP = "Ubah IP manual";

export const network = {
  hub: {
    title: "Pusat Jaringan & Perangkat",
    subtitle: "Hubungkan HP pelayan dan tablet dapur ke server utama dalam satu jaringan WiFi.",
    serverActive: "Server lokal aktif",
    demo: {
      title: "Sinkronisasi Mode Demo",
      subtitle: "Aplikasi berjalan sebagai demo di browser ini, tanpa server lokal.",
      badge: "Mode demo",
      noteTitle: "Hanya tab di browser ini yang tersinkron",
      noteBody:
        "Data demo disimpan di browser masing-masing perangkat, jadi HP atau tablet lain tidak dapat dipasangkan lewat QR dan akan melihat data yang berbeda. Untuk melihat sinkronisasi langsung, buka layar pelayan atau dapur di tab baru pada browser ini lalu buat pesanan.",
      openTitle: "Buka di tab baru (browser ini)",
      openWaiter: "Layar pelayan",
      openKitchen: "Layar dapur (KDS)",
    },
    serverAddress: "Alamat server utama:",
    editIp: EDIT_IP,
    saveIp: "Simpan",
    ipLabel: "Alamat IP server",
    ipExample: (example: string) => `Contoh: ${example}`,
    ipExampleHostName: "alamat-ip-laptop",
    ipSaved: "Alamat IP server lokal disimpan.",
    ipAuto: "Memakai alamat IP otomatis.",
    loopbackWarning:
      "Aplikasi dibuka lewat localhost, jadi HP dan tablet lain belum bisa mengaksesnya. Isi alamat IP laptop ini lewat Ubah IP manual.",
    connectedCount: (n: number) => `${n} tab terhubung`,
    tabsLabel: "Jenis perangkat",
    tabs: {
      waiter: "HP pelayan keliling",
      kitchen: "Layar dapur (KDS)",
      table: "QR menu meja",
      devices: (n: number) => `Perangkat (${n})`,
    },
    footerNote: "Pastikan semua perangkat tersambung ke router WiFi yang sama.",
    done: "Selesai",
    qrFailed: "QR gagal dibuat",
    copy: "Salin",
    copyLink: "Salin link",
    copied: (label: string) => `${label} disalin ke clipboard.`,
    copyFailed: "Tidak dapat menyalin. Salin link secara manual.",
    openNewTab: "Buka di tab baru",
    urlField: "Alamat link",
    waiter: {
      qrAlt: "QR code HP pelayan",
      qrTitle: "Scan dengan kamera HP pelayan",
      qrBody: "Langsung membuka mode pelayan keliling",
      linkTitle: "Link akses langsung",
      copyLabel: "Link pelayan",
      noteTitle: "Petunjuk penggunaan pelayan:",
      steps: [
        "Pastikan HP pelayan terhubung ke **WiFi restoran** yang sama.",
        "Buka kamera atau browser, lalu scan QR code di samping.",
        "Isi nama pelayan di HP dan langsung mulai mencatat pesanan di meja pelanggan.",
        "Pesanan yang dikirim langsung masuk ke **dapur (KDS)** dan **kasir**.",
      ],
    },
    kitchen: {
      qrAlt: "QR code layar dapur",
      qrTitle: "Scan untuk tablet dapur (KDS)",
      qrBody: "Layar antrean masak real-time untuk koki dan barista",
      linkTitle: "Link akses dapur (KDS)",
      copyLabel: "Link dapur",
      noteTitle: "Integrasi dapur real-time:",
      noteBody:
        "Pasang tablet di area dapur atau bar. Setiap pesanan baru dari pelayan atau kasir langsung muncul dengan bunyi bel dan timer antrean.",
    },
    table: {
      qrAlt: (name: string) => `QR code ${name}`,
      qrTitle: (name: string, area: string) => (area ? `QR code: ${name} (${area})` : `QR code: ${name}`),
      qrBody: "Pelanggan scan untuk memesan sendiri dari meja",
      pick: "Pilih meja",
      count: (n: number) => `${n} meja`,
      copyLabel: (name: string) => `Link ${name}`,
      noTables: "Belum ada meja",
      noTablesBody: "Tambahkan meja di halaman Meja untuk membuat QR menu.",
    },
    devices: {
      title: "Tab aktif di browser ini",
      body: "Tab aplikasi yang terbuka di browser ini. Perangkat lain di jaringan tidak ditampilkan.",
      refresh: "Segarkan",
      refreshed: "Daftar tab diperbarui.",
      thisDevice: "Perangkat ini",
      role: "Peran:",
      active: (seconds: number) => `Aktif ${seconds} detik lalu`,
      online: "Online",
      roles: { kasir: "Kasir", pelayan: "Pelayan", dapur: "Dapur", meja: "Meja" },
    },
  },
  guide: {
    title: "Panduan Server Lokal & Pelayan Keliling",
    subtitle: "Petunjuk operasional restoran lewat jaringan lokal dan beberapa perangkat.",
    tabsLabel: "Bagian panduan",
    tabs: {
      flow: "1. Arsitektur jaringan",
      setup: "2. Setup server utama",
      waiter: "3. Cara kerja pelayan",
      offline: "4. Hotspot / tanpa internet",
      troubleshoot: "5. Solusi kendala",
    },
    ready: "Server lokal siap digunakan.",
    openPairing: "Buka QR pairing",
    openPairingNow: "Buka QR pairing sekarang",
    close: "Tutup panduan",
    flow: {
      title: "Topologi restoran terintegrasi",
      intro:
        "Sistem ini dirancang bekerja lewat **jaringan lokal (LAN)**. Pencatatan pesanan, cetak struk, dan tiket dapur tidak bergantung pada koneksi internet dari luar.",
      nodes: [
        {
          id: "host",
          title: "Kasir utama (server host)",
          body: "Menyimpan menu, kategori, transaksi, dan laci kas.",
        },
        {
          id: "waiter",
          title: "HP pelayan keliling",
          body: "Mencatat pesanan di meja pelanggan dan mengirimnya langsung ke dapur.",
          path: "/pelayan",
        },
        {
          id: "kitchen",
          title: "Layar dapur (KDS)",
          body: "Tablet di dapur atau bar menerima pesanan real-time beserta timer masak.",
          path: "/dapur",
        },
      ],
      benefitsTitle: "Keunggulan arsitektur lokal:",
      benefits: [
        "**Respons cepat:** pesanan sampai ke dapur lewat jaringan lokal tanpa menunggu internet.",
        "**Hemat kuota:** data tersimpan di perangkat restoran Anda sendiri.",
        "**Pairing cepat:** cukup scan QR code dari layar kasir tanpa login yang rumit.",
      ],
    },
    setup: {
      title: "Langkah menjalankan server utama di laptop / PC kasir",
      steps: (port: string) => [
        {
          title: "Pastikan terhubung ke WiFi restoran",
          body: "Hubungkan laptop/PC server ke router WiFi yang sama dengan HP pelayan dan tablet dapur.",
        },
        {
          title: "Jalankan aplikasi kasir",
          body: `Server mendengarkan di port ${port}. Alamat server Anda saat ini:`,
          showAddress: true,
        },
        {
          title: "Buka pusat jaringan",
          body: "Klik tombol status server di pojok kanan atas untuk menampilkan QR code pairing bagi staf pelayan dan dapur.",
        },
      ],
    },
    waiter: {
      title: "Alur kerja pelayan keliling (order-taker)",
      steps: [
        {
          title: "Buka & atur identitas",
          body: "Pelayan membuka link **/pelayan** di HP, mengetik namanya sekali, lalu sistem mengingatnya.",
        },
        {
          title: "Pilih meja & catat pesanan",
          body: "Pelayan memilih meja tamu (status meja terlihat: terisi atau kosong), menambahkan menu, dan catatan khusus seperti “less sugar” atau “pisah kuah”.",
        },
        {
          title: "Kirim ke dapur (KDS)",
          body: "Tekan tombol kirim ke dapur. Layar KDS berbunyi dan tiket antrean masak langsung muncul.",
        },
        {
          title: "Bayar di tempat (opsional)",
          body: "Jika pelanggan ingin bayar di meja, pelayan dapat memakai pembayaran di tempat lewat tunai atau scan QRIS.",
        },
      ],
    },
    offline: {
      title: "Memakai hotspot HP tanpa internet",
      intro:
        "Jika restoran belum punya router WiFi tetap, gunakan **hotspot portabel** dari HP atau laptop kasir. Hotspot tidak perlu kuota internet untuk komunikasi antar perangkat:",
      steps: [
        "**Nyalakan hotspot portabel** di HP/laptop dan beri nama, misalnya WiFi-Kasir-Resto.",
        "**Sambungkan HP pelayan** ke hotspot tersebut.",
        "**Scan QR code di layar kasir:** HP pelayan langsung membuka sistem kasir lokal.",
      ],
      noteTitle: "Data tetap tersimpan:",
      note: "Transaksi disimpan di perangkat server. Saat aplikasi ditutup, data tidak hilang.",
    },
    troubleshoot: {
      items: (port: string, ipExample: string) => [
        {
          title: "1. HP pelayan tidak bisa membuka link setelah scan QR?",
          lines: [
            "Pastikan HP pelayan tersambung ke WiFi/hotspot yang sama dengan server kasir.",
            `Pastikan firewall di komputer server tidak memblokir port ${port}.`,
            `Gunakan **${EDIT_IP}** di Pusat Jaringan untuk memasukkan alamat IP WiFi laptop Anda, misalnya ${ipExample}.`,
          ],
        },
        {
          title: "2. Pesanan dari pelayan tidak muncul di dapur?",
          lines: [
            "Pastikan HP pelayan dan layar dapur memakai alamat server yang sama.",
            "Buka tab **Perangkat** di Pusat Jaringan untuk melihat tab yang sedang aktif di browser ini.",
          ],
        },
        {
          title: "3. Ingin mengganti IP server utama saat berpindah router?",
          lines: [
            `Buka **Pengaturan**, klik **Pusat Jaringan**, lalu klik **${EDIT_IP}** dan masukkan IP baru dari router.`,
          ],
        },
      ],
    },
  },
} as const;
