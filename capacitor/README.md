# Persiapan Capacitor — WAKRO Digital

Fondasi pembungkusan APK Android. **Toolchain Android sengaja belum dipasang** (fase stabilitas). Ikuti langkah ini saat siap build APK.

## Prasyarat (saat eksekusi nanti)
1. Node 20+ (sudah ada)
2. JDK 21 + Android Studio (SDK 34+)

## Langkah
```bash
cd apps/web
pnpm add -D @capacitor/cli
pnpm add @capacitor/core @capacitor/android
pnpm exec cap init "KASA" "id.kasa.kasir" --web-dir=dist
pnpm exec cap add android
pnpm build:local       # mode demo lokal; `pnpm build` untuk mode Worker + D1
pnpm exec cap sync android
pnpm exec cap open android   # build APK dari Android Studio
```

## Config
Salin `capacitor.config.example.ts` → `apps/web/capacitor.config.ts` (sudah disesuaikan webDir + appId).

## Catatan
- Kamera barcode butuh secure context — di WebView Capacitor berjalan `https://localhost` default ✓
- Printer thermal Bluetooth (ESC/POS) menyusul via plugin BLE (`@capacitor-community/bluetooth-le`) — interface `EscPosBluetoothDriver` sudah disiapkan
- Service worker PWA tidak perlu aktif di dalam WebView (offline dijamin storage native)
