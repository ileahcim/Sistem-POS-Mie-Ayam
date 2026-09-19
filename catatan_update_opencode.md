# Catatan Update — Pencetakan Struk ke Printer Thermal ECO80D

*Sesi: opencode · 19 Sep 2026 · dibangun di atas implementasi awal Copilot (lihat `update_versi_copilot.md`).*

## Ringkasan

Menyalakan pencetakan fisik ke printer thermal **Blueprint ECO80D** (80mm, kertas termal, cutter **manual**). Arsitektur final:

- Satu builder **ESC/POS** (`src/lib/printing/escpos.ts`) menghasilkan byte yang sama untuk semua driver — Web Bluetooth (utama, tanpa watermark) dan RawBT (cadangan).
- Driver aktif disimpan di kolom `Setting.printerDriver`, dipilih owner di `/admin/settings`, dan dibaca dari server (`getSettings()`) lalu diteruskan ke komponen cetak.
- **Cetak tidak pernah memblokir transaksi**: setiap pemanggilan print dibungkus try/catch; kegagalan hanya tampil sebagai teks error inline + `console.error`.
- Migrasi `20260919100000_printer_driver` sudah diterapkan ke database (nilai singleton terverifikasi: `webbluetooth`).

## File baru

### `src/lib/printing/escpos.ts` — source of truth payload cetak

- `buildReceiptBytes(data)` / `buildPackingListBytes(data)` → `Uint8Array` ESC/POS.
- 48 kolom Font A (memakai `RECEIPT_CHARS_PER_LINE` dari `paper.ts`).
- Layout struk = desain final `ReceiptView`: header warung, `No. Order`, `Tanggal`, `Jam`, `Kasir`, `Tipe`; item `Nama xQty` + harga rata kanan; add-ons indented; `Subtotal` / `Ongkir` / `TOTAL` / `Bayar` / `Kembali`; footer `centeredRule`. **Tanpa Antrian di struk** (order sudah lunas — konsisten dengan `ReceiptView`).
- Daftar packing memakai `formatQueueLabel(...)` untuk baris Antrian dan **tanpa harga** (checklist `[ ]`), seperti `PackingListView`.
- Channel → `CHANNEL_LABEL`, metode bayar → `PAYMENT_LABEL`.
- **Sanitizer ASCII**: teks diubah ke byte ASCII; latin-1/typografi (é, –, “”, …) dipetakan ke pasangan ASCII terdekat, sisanya → `?`; `\r` dibuang; `\n` dipertahankan (dipakai sendiri untuk baris). `TextEncoder` tidak dipakai — tiap code unit = 1 kolom, mencegah garble kode halaman.
- Perintah: `ESC @`, `ESC a n`, `ESC E n`, `ESC d n` (feed 3). **Tanpa `GS V` cut** — cutter ECO80D manual.
- `rightLine()` menangani overflow: label+value > 48 kolom dipecah dua baris, value rata kanan.

### `src/lib/printing/test-print.ts` — satu pintu "Tes Printer"

- `buildTestReceipt()` / `buildTestPackingList()` (sampel `/print-preview` dipindah ke sini untuk dipakai dua tempat), `printTest(driver)` / `printPackingListTest(driver)`.
- Dipakai tombol "Tes Printer" di Pengaturan dan tombol cetak fisik di `/print-preview`.

### `src/types/web-bluetooth.d.ts`

- Minimal subset tipe Web Bluetooth (Chrome-only; TS `lib.dom` tidak punya API ini). Semua di dalam `declare global` agar terlihat global.

## File diimplementasi ulang / direvisi

### `src/lib/printing/printers/web-bluetooth-printer.ts` *(stub Copilot → implementasi penuh)*

- `connectPrinter()`: `navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [UUID terkait] })` — butuh user gesture (tombol "Hubungkan Bluetooth").
- Setelah pairing, UUID service + karakteristik + nama disimpan di `localStorage` (`pos.printer.webbluetooth.v1`); cetak berikutnya reconnect diam-diam via `navigator.bluetooth.getDevices()`.
- `findWriteCharacteristic`: probing UUID service BLE-serial umum (`0xFF00`, `0xFFE0`, `0x18F0`) lalu fallback scan penuh; **hanya** menulis ke karakteristik dengan properti write / writeWithoutResponse.
- Selalu membalas `{ok, error}` jujur; `isWebBluetoothSupported()` menutup kasus iPhone/Safari/HTTPS.
- `PRINTER_CHANGED_EVENT` dikirim setiap pairing berhasil — label "Terhubung" di Pengaturan repaint lewat `useSyncExternalStore` (tanpa `useEffect` + `setState`).
- **Chunking GATT** (`writeChunked`): Chrome menolak `writeValue` > 512 byte ("Value can't exceed 512 bytes"). Payload dipecah jadi frame ≤512 byte dengan jeda 30ms antar frame agar bridge UART printer (kebanyakan chip murah) sempat mengosongkan buffer — tanpa jeda, printer bisa membuang byte.

### `src/lib/printing/printers/rawbt-printer.ts` *(revisi implementasi Copilot)*

- **Sebelum**: membangun ulang byte sendiri (format lama: ada `Antrian`/`No. Order` campur, tanpa `Kasir`/`Tipe`, `GS V 0` cut, `rightLine` tidak menangani overflow, semua non-ASCII dijadiin `?`).
- **Sesudah**: byte dari `escpos.ts` (layout konsisten, overflow aman, sanitizer yang lebih halus), tanpa `GS V` (cutter manual), status jujur — `transmitToRawBt` cek `isAndroid()`, kirim `intent:base64,...rawbt...` dan balas "perintah terkirim" (RawBT app eksternal; cetak fisik tak bisa diverifikasi dari browser).

### `src/lib/printing/get-printer.ts`

- **Sebelum** (dari Copilot): `PrinterDriver` dideklarasi di sini, default `rawbt`, class `RawBtPrinter`/`WebBluetoothPrinter`.
- **Sesudah**: `PrinterDriver` dipindah ke `types.ts` (supaya server `StoreSettings` bisa memakainya tanpa menarik modul client), default `webbluetooth`, driver sebagai object singleton `webBluetoothPrinter` / `rawBtPrinter`.

### `src/lib/printing/types.ts`

- Tambah `export type PrinterDriver = "mock" | "webbluetooth" | "rawbt"` (satu sumber kebenaran).

### `prisma/schema.prisma` + `prisma/migrations/20260919100000_printer_driver/` + `prisma/seed.ts`

- Kolom baru: `printerDriver String @default("webbluetooth")`.
- Migrasi: `ALTER TABLE "Setting" ADD COLUMN "printerDriver" TEXT NOT NULL DEFAULT 'webbluetooth';` — **sudah di-deploy** (`npx prisma migrate deploy`).
- `seed.ts`: tambah `printerDriver: "webbluetooth"` di blok `create` upsert (tetap `update: {}` agar tidak menimpa pilihan owner).

### `src/lib/settings/get-settings.ts`

- `StoreSettings` + `FALLBACK` + mapping kini menyertakan `printerDriver` (cast `as PrinterDriver` karena kolom DB bertipe String).

### `src/app/admin/settings/actions.ts`

- Tambah `updatePrinterDriver(driver)`: `requireRole("OWNER")` + whitelist `PRINTER_DRIVERS` + tulis ke singleton.

### `src/components/admin/settings-screen.tsx`

- Kartu "Printer struk": picker 3 mode (Preview / Bluetooth / RawBT) tersimpan seketika dengan rollback + flash "Tersimpan ✓"; tombol "Hubungkan Bluetooth" (hanya mode Bluetooth, label berubah jadi "Hubungkan ulang"), tombol "Tes Cetak", teks bantuan per mode, dan status jujur (terhubung / error).

### Perutean `printerDriver` ke komponen cetak

- `src/app/pembayaran/[orderId]/page.tsx`, `src/app/order-aktif/[orderId]/page.tsx`, `src/app/riwayat-pesanan/[orderId]/page.tsx` → terima `settings.printerDriver` dari `getSettings()` dan teruskan ke komponen.
- `src/components/pembayaran/pembayaran-screen.tsx`: auto-print + "Ya, Cetak" memakai `getPrinter(printerDriver)` di dalam try/catch; **navigation ke `/order-aktif` tidak pernah diblokir**, error dicatat `console.error` (auto) atau tampil inline (alur "Cetak struk?").
- `src/components/order-aktif/order-detail.tsx`: "Print Daftar" memakai driver aktif; error tampil inline.
- `src/components/riwayat-pesanan/riwayat-detail.tsx`: "Cetak Ulang Struk" memakai driver aktif; error tampil inline.

### `src/app/print-preview/page.tsx`

- Preview mock tetap (via `MockPrinter`), ditambah pemilih driver (Mock / Web Bluetooth / RawBT) dan tombol "Cetak Struk ke …" + "Cetak Daftar Packing" yang mengirim byte ESC/POS yang sama dengan produksi.

## Verifikasi

- `tsc --noEmit --incremental false` → bersih.
- `npm run lint` → bersih.
- `npm run build` → sukses.
- Migrasi terpasang; `select printerDriver from "Setting"` → `"webbluetooth"`.

## Catatan operasional (bukan kode)

- **Web Bluetooth tidak didukung iPhone/iOS** (termasuk Chrome iOS). Tes harus di tablet **Android + Chrome**, lewat HTTPS.
- Pairing Web Bluetooth adalah izin per-browser (tersimpan di `localStorage` device tsb); tablet kedua harus dipasangkan sekali tersendiri.
- RawBT versi **gratis** menyetak footer/watermark di tiap dokumen; lisensi berbayar menghapusnya. Itu kenapa default Web Bluetooth (tanpa watermark).
- Calon pengaturan yang tidak diubah dari RawBT default: BIG5 init, profile ESC general, `GS v 0` default (tidak relevan — kita kirim byte ESC/POS langsung), status transmission OFF, delay inter-packet 25ms, tunggu 3s.

## Langkah tes fisik setelah deploy

1. Nyalakan ECO80D + pasang gulungan 80mm. Pairing Android Settings → Bluetooth → ECO80D (PIN umum `0000`/`1234`).
2. (Opsional cadangan) Install **RawBT** (`ru.a402d.rawbtprinter`), tombol `+` → Bluetooth → ECO80D → Tes cetak.
3. Tablet Chrome → aplikasi → Pengaturan → pilih **Bluetooth** → **Hubungkan Bluetooth** → pilih ECO80D → **Tes Cetak**.
4. Buat 1 transaksi uji (item + add-on + catatan + ongkir + teks non-ASCII) lalu Bayar; cek struk hasil, daftar packing (order ANTAR), dan Cetak Ulang di riwayat.