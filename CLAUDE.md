@AGENTS.md

# POS Mi Ayam

POS untuk satu warung mi ayam/bakso (Cipta Rasa, Wonogiri) — kasir di tablet Android landscape, dipakai karyawan lanjut usia yang kurang terbiasa teknologi; pemilik (OWNER) membuka/menutup shift, melihat Dashboard dari HP, dan mencatat buku utang terpisah (modul **Note**: Mi Mentah & Frozen). Fitur inti: order Dine In/Bungkus/Antar dengan add-on, Order Aktif + timer, Pembayaran (Cash/QRIS/Cash+QRIS/Belum Bayar), Pre-order + DP, Shift & rekonsiliasi kas, struk thermal Bluetooth (Blueprint ECO80D), Dashboard & export Excel. **Live sejak 22 Sep 2026 — database berisi transaksi asli.** Keputusan produk di sini dan di `docs/` sudah final hasil diskusi dengan pemilik: jangan diubah tanpa konfirmasi ulang; kalau ada yang terlihat keliru secara teknis, bilang dulu sebelum ngoding.

## Stack & perintah

- Next.js **16.3.5** (App Router, ada breaking changes — baca `node_modules/next/dist/docs/` dulu, lihat AGENTS.md), React 19.2, TypeScript, Tailwind 4 (`@theme` di `src/app/globals.css`), `motion`, `exceljs`.
- Prisma **7.10** + `@prisma/adapter-pg` → Supabase Postgres (`DATABASE_URL` transaction pooler 6543 untuk runtime, `DIRECT_URL` session pooler 5432). Supabase Auth (username → email sintetis `username@warung.local`) + Storage (bucket `product-images`).
- Deploy: Vercel `leahcim-team/pos-mi-ayam` → `https://pos-mi-ayam.vercel.app`, **auto-deploy setiap push ke `main`**. Build Vercel cuma `next build`, tidak menjalankan migrasi.
- Perintah: `npm run dev` · `npm run build` (+ `npm start` untuk uji build produksi) · `npx tsc` · `npx eslint src` (`npm run lint`) · `npm run db:seed` · `npm run db:studio`. `db:migrate` (`prisma migrate dev`) / `db:push` hanya terhadap schema sementara, dan pengaman AI Prisma 7.10 akan menolaknya — lihat aturan pengaman di bawah. **Jangan pernah `prisma migrate reset`.**
- Mematikan dev server: `pkill -f next-server` juga, bukan cuma kill port.
- Struktur: `src/app/<route>/` (page + `actions.ts` server action), `src/lib/<domain>/` (logika murni: `orders`, `deposits`, `shift`, `printing`, `mie`, `frozen`, `note`, `dashboard`, `cart`, `combo`, `settings`, `timezone.ts`), `src/components/ui/` (design system), `prisma/` (schema, migrasi, seed), `src/proxy.ts` (auth gate).

## Aturan kerja wajib

Versi lengkap: `docs/working-rules.md`.

- **🔒 Database produksi.** DILARANG menghapus, mengubah, atau membuat baris data apa pun tanpa izin eksplisit pemilik, termasuk untuk testing. Semua testing di schema sementara (`CREATE SCHEMA <nama>_test`, copy `User`+menu read-only, jalankan skenario, `DROP SCHEMA`). Aman hanya karena kode tidak memakai `$queryRaw`/`$executeRaw` — jangan tambahkan. Backup pra-go-live: `/root/pos-mi-ayam-db-backups/backup-20260922/`. Script `pg` mentah di mesin ini salah membaca kolom TIMESTAMP(3) (7 jam) — pakai Prisma + `timezone.ts` untuk waktu.
- **Pengaman tool tidak boleh dilewati dengan cara apa pun** (aturan pemilik 24 Sep 2026). Kalau pengaman (mis. gerbang AI Prisma untuk `db push`/`migrate`) menghalangi: **berhenti dan tanya pemilik**. Jangan cari jalan lain (`migrate diff` + `pg` polos, ganti env var, tool pengganti). Pemilik sendiri yang mengetik persetujuan saat itu (mis. `!<command>`).
- **Bahasa:** semua balasan & rangkuman ke pemilik wajib **Bahasa Indonesia**. Kode, nama variabel, komentar teknis tetap Inggris.
- **Git:** commit & push otomatis setiap selesai satu tahap/batch, tanpa minta konfirmasi; satu commit = satu tahap. **Tapi jangan push ke `main` selama jam buka warung kecuali pemilik menyuruh** (push = deploy ke kasir yang sedang dipakai). **Migrasi diterapkan ke DB SEBELUM kode yang membutuhkannya di-push.** Tetap dilarang: force-push, `reset --hard`, amend commit yang sudah dipush, skip hooks. **Jangan membuat file screenshot di repo** — verifikasi visual lewat Playwright dengan assert teks/DOM.
- **Otorisasi server:** setiap aksi OWNER-only memanggil `requireRole("OWNER")` di **baris pertama** server action-nya; menyembunyikan tombol bukan pengaman. Verifikasi dengan capture-replay (request asli dari sesi OWNER, replay dari sesi CASHIER sungguhan → ditolak DAN data tidak berubah). Detail: `docs/architecture.md`.
- **Zona waktu:** semua pengelompokan per hari, batas tanggal, dan tampilan tanggal/jam di server WAJIB lewat `src/lib/timezone.ts` (`localDateStr`, `localTimeStr`, `localDateParts`, `wibDateRange`, `formatId`, …). Jangan `getHours()`/`getFullYear()`, `toISOString().slice()`, atau `Intl.DateTimeFormat` tanpa `timeZone` — Vercel jalan di UTC. Pengecualian aman (durasi rolling, banding instant, tulis timestamp, input tanggal dari tablet): `docs/architecture.md`.
- **`export const dynamic = "force-dynamic"` di `src/app/layout.tsx` jangan dihapus/di-override** — tanpanya halaman yang cuma memanggil Prisma dibekukan statis oleh `next build`.
- **File `"use server"` hanya boleh mengekspor fungsi async** (melanggarnya lolos `next build` tapi gagal di runtime). Konstanta bersama di file netral. Build hijau bukan bukti — cek nilai di DB setelah menekan tombol.
- **Batas client/server:** jangan value-import modul yang menyentuh Prisma dari client component; style/logic bersama di file netral tanpa `"use client"` (pola `button-styles.ts`).
- **UI:** pakai token & komponen `src/components/ui/` (`Button`, `LinkButton`, `Card`, `ListRow`, `Sheet`, `Badge`, `PriceText`, `AppHeader`). Tombol ≥48px, satu aksi utama per layar, tanpa dark mode. Sheet add-on Kasir sengaja tanpa animasi. Uji di 1366×1024 / 390×844 / 844×390, tanpa scroll horizontal.
- Setelah mengubah rumus laci/shift/DP: `npx tsc`, `npx eslint src`, lalu ulangi uji aljabar/skenario (lihat `docs/spec-kasir.md`).

## Aturan bisnis kritis (sering salah)

- **Single outlet** — tidak ada model Outlet/cabang; konfigurasi toko di singleton `Setting`. Nama/alamat/telepon/footer struk selalu dari `Setting`, tidak pernah hardcode.
- Menu = produk base + add-on. Bakso Urat Ceker = **18.000** (benar; menu cetak salah 19.000). "Tambah Bakso" di Mie Ayam/Pangsit Rebus/Ceker = upgrade **maks 1** (radio); "Topping Mie" (Pangsit/Ceker) stepper. "Jenis Bakso" opsional, tanpa opsi "Biasa". Soft delete (`isActive`), tidak pernah hard delete; migrasi menu memindah/mengganti nama baris **di tempat** (id tetap).
- Channel hanya **Dine In / Bungkus / Antar** (tidak ada ojol). Meja: K1, K2, L1, L2, L3. Ongkir Antar Rp1.000 per porsi **kategori Makanan saja**, tidak pernah disimpan — selalu diturunkan dari `channel`.
- Order default **belum dibayar**; `servedAt` dan `paidAt` independen. Bungkus/Antar otomatis selesai saat dibayar; Dine In dua langkah. Nomor antrian server-side, reset per shift. Harga/nama/HPP di-snapshot ke `OrderItem`. **Total selalu dihitung ulang di server.**
- **Satu order = satu pembayaran = satu struk.** `PAID` beku. Batalkan (`CANCELLED`) = order `OPEN`, boleh CASHIER, wajib alasan. Void = khusus `PAID`, OWNER, wajib alasan. Ubah Metode Bayar = OWNER, ditolak kalau shift sudah tutup. Order ber-DP ditolak server untuk batal biasa, void, ubah metode, Pisahkan & Bayar, Tandai Piutang.
- **Angka shift dibekukan saat tutup shift, tidak pernah dihitung ulang.** `expectedCash` tidak tampil sebelum hitungan fisik dimasukkan (hitung-buta). Pengeluaran dicatat sebelum hitung fisik. Uang diterima/kembalian dan uang Note **tidak pernah** masuk rumus laci. Rumus laci satu tempat: `computeShiftClosing` (`src/lib/deposits/shift-math.ts`).
- **Pre-order** boleh dibuat tanpa shift; `shiftId`/`queueNumber` baru diisi saat dibayar. DP: omzet diakui penuh di hari kirim, DP hanya menggeser laci (ledger `PreorderDeposit`).
- Piutang (`RECEIVABLE`) tidak dihitung penjualan; pelunasan dihitung ke shift yang terbuka saat dibayar (`settledShiftId`); pelunasan tunai wajib pilih laci/kantong.
- **Struk:** isi ditentukan SATU tempat (`src/lib/printing/receipt-layout.ts`); MockPrinter = acuan; 48 kolom Font A; penekanan tebal saja (tanpa ukuran ganda); raster MSB = titik paling kiri. Cetak tidak pernah memblokir transaksi tapi kegagalan wajib terlihat. Urutan baris layar & kertas: `sortOrderLines`.
- **Note** (Mi Mentah & Frozen) = dunia terpisah dari POS (tidak pernah menyentuh Shift/Order/omzet), OWNER only, tidak butuh shift. Saldo = jumlah baris ledger, tidak pernah kolom tersimpan; koreksi = baris baru; nonaktif bukan hapus (saldo tetap ikut Total Piutang); metode bayar lama yang NULL tidak pernah di-backfill.
- **PWA:** service worker hanya cache shell; **jangan pernah** antrian transaksi offline atau cache halaman data.

## Dokumentasi di `docs/` — kapan dibaca

Semua isi CLAUDE.md lama dipindah **verbatim** dengan judul bagian yang sama (komentar kode merujuk `CLAUDE.md "<judul>"` — cari judulnya di tabel ini). Salinan utuh file lama: `docs/archive/CLAUDE.full-backup.md`.

| File | Isi (judul bagian asli) | Baca sebelum… |
|---|---|---|
| `docs/working-rules.md` | Kotak DATABASE PRODUKSI, Pengaman tool, Bahasa, Alur kerja Git | ragu soal izin data, pengaman tool, atau commit/push |
| `docs/architecture.md` | Zona waktu · Rendering dinamis · Auth · Server-side authorization · Design System (token, komponen, animasi, header, kartu produk, foto produk, jebakan client/server, `"use server"`) | menulis kode server, query per tanggal, aksi OWNER, atau UI/komponen baru |
| `docs/business-rules.md` | Konteks pengguna (kepadatan layar, `dense`) · Menu & harga · Ongkir · Yang belum diputuskan | mengubah menu, harga, add-on, atau tata letak layar kasir |
| `docs/spec-kasir.md` | Order & status · Split payment ("Pisahkan & Bayar") · Pembayaran (Hitung kembalian, Belum Bayar & pelunasan piutang, Cash + QRIS) · Order Aktif — timer · Pre-order (+ DP uang muka) · Shift & kas · Lain-lain (menu populer/`ComboCache`, soft delete, animasi) | menyentuh Kasir, Order Aktif, Pembayaran, Pre-order, DP, piutang, shift, rumus laci |
| `docs/spec-printing.md` | Struk & printer · Kertas dapur (kitchen ticket) | mengubah struk, ESC/POS, driver printer, logo, kertas dapur, bukti DP |
| `docs/spec-dashboard.md` | Dashboard — Tahap 11 Bagian B · Filter rentang tanggal | mengubah `/dashboard`, export Excel, grafik, preset tanggal, filter Riwayat Pesanan |
| `docs/spec-note-mi-mentah.md` | Catatan Mi Mentah (modul Note) | menyentuh `/note`, `src/lib/mie`, `src/lib/note` |
| `docs/spec-note-frozen.md` | Buku Frozen (modul Note) | menyentuh `/note/frozen`, `src/lib/frozen`, bukti Frozen (baca juga spec Mi Mentah) |
| `docs/deploy-ops.md` | PWA — Tahap 12 · Deploy Vercel · Backup & Pemulihan · Prosedur Pemulihan (restore) | mengubah `sw.js`, manifest, matcher `src/proxy.ts`, setting Vercel, workflow backup, atau melakukan restore |
| `docs/progress-log.md` | GO-LIVE 22 Sep 2026 + checklist go-live (password masih `1234`, HPP belum diisi, tes cetak tersisa, auto-deploy) | butuh konteks go-live / pekerjaan yang masih terbuka |
| `docs/archive/CLAUDE.full-backup.md` | Salinan utuh CLAUDE.md sebelum dirapikan (173.9k) | hanya kalau curiga ada yang hilang |

Riwayat per fitur (tanggal dibangun, nama schema uji, jumlah pemeriksaan, data produksi yang pernah dikoreksi atas izin pemilik) menempel di bagian fiturnya masing-masing di `docs/spec-*.md`.
