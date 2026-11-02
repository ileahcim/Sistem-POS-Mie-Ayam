# Spesifikasi Es Krim (stok per pcs)

Es krim Diamond, dibeli per box, dijual per pcs. **Satu-satunya produk POS yang punya stok.** Dibangun 2–3 Nov 2026 (migrasi `20261102200000_es_krim_stock`, uji di schema `eskrim_test`). Keputusan di bawah sudah final dari pemilik — jangan diubah tanpa konfirmasi ulang.

## Data

- Kategori **"Es Krim"** (`ICE_CREAM_CATEGORY_NAME` di `src/lib/stock/types.ts`, sortOrder 5 = tab paling kanan, `isKitchenItem=false` → tidak masuk kertas dapur). Ongkir Antar tidak berlaku (bukan kategori Makanan).
- `Product.tracksStock=true` hanya untuk es krim. Kolom `stock` (pcs), `unitsPerBox`, `boxPrice` (harga beli per box hasil Barang Masuk terakhir). `costPrice` = `round(boxPrice ÷ unitsPerBox)`, **dihitung server**, tidak pernah diketik — ikut tersnapshot ke `OrderItem.costPrice` seperti produk lain, jadi Margin Dashboard otomatis benar.
- `StockMovement` = riwayat stok, **append-only**, satu baris per perubahan: `kind` (RESTOCK "Barang Masuk", SALE "Terjual", SALE_RETURN "Batal/Void", CORRECTION "Koreksi", SELF_USE "Ambil Sendiri"), `qtyChange` (bertanda), `stockAfter`, `unitCost` (snapshot modal saat itu), `orderId?`, `takenBy?`, `note?` (alasan koreksi), `boxes/unitsPerBox/boxPrice?` (Barang Masuk), `createdById`, `createdAt`.
- Invarian: `Product.stock` = jumlah `qtyChange` semua baris produk itu. Stok tidak pernah minus: pengurangan hanya lewat `updateMany … where stock >= qty` + CHECK constraint DB `Product_stock_nonnegative`.
- Data awal (di migrasi): 7 produk dari belanja 31 Okt 2026 + 7 baris RESTOCK bertanggal 31 Okt 2026 12:00 WIB atas nama OWNER tertua, catatan "Stok awal (belanja 31 Okt 2026)". Produk lain ditambah pemilik sendiri lewat halaman Stok Es Krim.
- Mie Frozen sudah `isActive=false` sejak sebelum fitur ini (tidak ada yang perlu diubah).

## Logika stok — satu tempat: `src/lib/stock/apply.ts`

- `changeStock(tx, …)` satu-satunya yang mengubah `Product.stock`, selalu di transaksi yang sama dengan baris `StockMovement`-nya. Gagal → `StockError` → transaksi batal utuh → `{ ok: false, error }` ke layar ("Stok X habis." / "Stok X tidak cukup — tinggal N pcs.").
- `syncOrderStock(tx, { removed, added })` dipakai semua jalur order: menghitung **selisih bersih per produk** (edit yang qty-nya sama tidak membuat baris), mengunci produk berurutan id (anti-deadlock), mengabaikan produk non-stok & item custom.
- **Kapan stok bergerak:**
  - Item masuk order → **Terjual** (minus): `saveOrder`, `addItemsToOrder`, `editOrderItem` (naik qty / ganti produk).
  - Item dikurangi/dihapus → **Batal/Void** (plus): `removeOrderItem`, `editOrderItem`.
  - Order dibatalkan (`cancelOrder`, `cancelOrderWithDeposit`) atau di-void (`voidPaidOrder`) → semua item kembali.
  - **Pre-order: stok dipotong saat pre-order dibuat** (keputusan pemilik 2 Nov 2026 — es krimnya disisihkan), kembali kalau dibatalkan.
  - Bayar (`payOrder`, Pisahkan & Bayar, Belum Bayar/Piutang) **tidak** menyentuh stok — stok sudah keluar saat item masuk order.

## Kasir

- Tab "Es Krim" memakai kartu & stepper `[−] qty [+]` yang sama dengan produk lain (tanpa add-on, langsung masuk keranjang).
- Kartu menampilkan sisa stok dikurangi yang sudah di keranjang: teks samar "stok N"; **≤ 5** (`LOW_STOCK_THRESHOLD`) jadi badge kecil "sisa N"; **0** → kartu abu-abu, tulisan "Stok habis", tidak bisa ditekan. Tombol + di keranjang (Kasir, Pre-order, "+ Tambah Item") terkunci saat mencapai stok.
- Angka di layar hanya bantuan; **server tetap penentu** (dua tablet bisa berebut pcs terakhir — yang kalah dapat pesan "Stok … habis" dan layar di-refresh).
- Lembar "Edit" item belum membatasi stepper ke stok; kelebihan ditolak server dengan pesan yang jelas.

## Ambil Sendiri (dimakan keluarga)

- Tombol **"Ambil Sendiri"** muncul di Kasir saat tab Es Krim aktif, dan tombol utama di halaman `/es-krim`. **Semua peran** boleh (`recordSelfUse`, `requireUser`).
- Pilih produk → jumlah (maks stok) → nama yang ambil (opsional) → Catat. Hanya membuat baris `SELF_USE`; **bukan penjualan, tidak pernah menyentuh Shift/Order/laci/kas**.
- Dashboard: "Es krim diambil sendiri: X pcs, senilai Rp Y" per rentang tanggal Dashboard, dinilai dari `unitCost` (modal) baris itu.

## Halaman `/es-krim` ("Stok Es Krim", menu utama, semua peran)

- Semua peran: daftar stok sekarang + Ambil Sendiri.
- **OWNER saja** (tombol disembunyikan untuk kasir **dan** `requireRole("OWNER")` di baris pertama tiap server action, diverifikasi capture-replay 3 Nov 2026 — 5 aksi ditolak dari sesi CASHIER, data tidak berubah):
  - **Barang Masuk** (`recordRestock`): produk, jumlah box, isi per box, harga per box → stok + (box × isi), `unitsPerBox`/`boxPrice`/`costPrice` produk diperbarui. Order lama tetap memakai HPP snapshot-nya.
  - **Koreksi Stok** (`recordCorrection`): kurangi/tambah pcs, **alasan wajib** (pilihan cepat Rusak/Meleleh/Salah hitung/Hilang atau ketik sendiri). Tidak bisa melebihi stok.
  - **+ Produk Es Krim Baru / Edit** (`createIceCreamProduct`, `updateIceCreamProduct`): nama, harga jual per pcs, isi per box, harga beli per box. Stok baru selalu 0 — stok hanya masuk lewat Barang Masuk (supaya selalu ada riwayatnya).
  - **Nonaktifkan / Aktifkan lagi** (`setIceCreamActive`) — soft delete, tidak pernah hapus.
  - **Riwayat** per produk (`/es-krim/[productId]`, OWNER only; kasir di-redirect ke `/es-krim`): waktu, jenis, ±pcs, stok sesudah, pengguna, catatan/nama pengambil, link ke order.
- Es krim **tidak** diatur di Manajemen Menu atau Isi HPP: keduanya mengecualikan produk `tracksStock` / kategori Es Krim dan server menolak perubahan lewat jalur itu (harga modal es krim selalu dari Barang Masuk).

## Struk, Dashboard, Excel

Es krim adalah `OrderItem` biasa: otomatis tampil di struk, Order Aktif, Riwayat Pesanan, Omzet, Menu Terlaris, Margin, Per Channel, dan export Excel. Tidak ada kode khusus.

## Pengujian (3 Nov 2026, schema `eskrim_test`)

- Migrasi dijalankan apa adanya ke schema lama → `db push` "already in sync".
- Logika: 12 transaksi paralel × 4 pcs dari stok 30 → tepat 7 sukses, stok 2, tidak pernah minus; rollback utuh; edit qty sama tanpa baris; CHECK constraint menolak stok −1.
- Browser (build produksi): simpan order, kurangi/tambah/hapus item, edit qty, batal order, bayar + void, pre-order + DP lalu batal (DP hangus), Ambil Sendiri dari Kasir, Barang Masuk (HPP berubah, order lama tetap), Koreksi, produk baru/edit/nonaktif, Dashboard Margin & Ambil Sendiri, struk MockPrinter. Invarian stok = jumlah riwayat terjaga di akhir.
- 1366×1024 / 390×844 / 844×390: tanpa scroll horizontal, kontrol baru ≥ 48px.
- Pengujian lokal ke schema lain: `DATABASE_SCHEMA=<nama>_test npm start` (`src/lib/prisma.ts`; kosong di Vercel = `public`).
