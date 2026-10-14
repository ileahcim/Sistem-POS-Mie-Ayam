# Catatan Perubahan — opencode

Log tiap tahap/commit pengerjaan fitur pengaturan harga **Mi Mentah** & **Mi Frozen** di halaman
Pengaturan (Manajemen Menu dan Isi HPP), plus perbaikan kecil di Form Pesanan Baru Note.

- Aturan commit: tiap pesan diakhiri ` -opencode`, versi naik `update v1`, `update v2`, dst.
- Lingkup: **hanya** judul section di halaman pengaturan. Tidak membuat Product/Category/Add-on
  baru, tidak menyentuh layar kasir / order-aktif / pembayaran. Data tetap dari tabel modul Note
  yang sudah ada (`MieProductDefault`, `MieSetting`).
- **Sengaja TIDAK diubah** (lihat juga tiap entri): schema Prisma, folder `prisma/migrations`,
  file `.env`, dan seluruh data produksi (tidak ada UPDATE/seed/migrasi data). Field modal Mi
  Frozen tidak dibuat karena memang belum ada di schema.

---

## v1 — 14 Okt 2026

**Judul:** Section "Mi Mentah" & "Mi Frozen" di Manajemen Menu (`/admin/menu`).

**File diubah:**
- `src/app/admin/menu/page.tsx` (baris 5–7 dan 19–42, file akhir 44 baris)
  - Tambah impor `getMieProductDefaults`, `getMiePasarPrice`, `getFrozenPrice` (baris 5–7).
  - Sebelum → sesudah: `Promise.all` semula hanya `getMenuAdminData`, `getBaksoUsageSetting`,
    `getHeaderNav`; sekarang ditambah tiga query harga mi. Prop baru diteruskan ke `MenuAdminScreen`
    (`mieDefaults`, `miePasarPricePerKg`, `frozenPricePerPcs`).
- `src/components/admin/menu-admin-screen.tsx` (baris 3–14 dan 113–146, file akhir 154 baris)
  - Tambah impor `MieProductDefaults`, `MIE_FIXED_PRODUCT_TYPES`, `MIE_PASAR_LABEL`,
    `MIE_PRODUCT_LABEL`, dan komponen `MieProductDefaultRow` (komponen Note yang sudah ada) (baris 3–9).
  - Tambah prop `mieDefaults`, `miePasarPricePerKg`, `frozenPricePerPcs`.
  - Tambah `<section>` **"Mi Mentah"** di **paling bawah, setelah semua section lain** (setelah
    Perkiraan Bakso Terpakai): 4 baris harga jual default per kg — Mi Keriting, Mi Lurus, Pangsit,
    Mi Pasar — lalu sub-section **"Mi Frozen"** (1 baris harga jual per pcs).
  - Sebelum → sesudah: halaman berakhir di `BaksoUsageSettingsForm`; sekarang ada section Mi Mentah
    di bawahnya.

**Yang dipakai ulang (tanpa sumber data baru):**
- Action: `updateMieProductDefault`, `updateMiePasarPrice` (note/actions.ts) dan `updateFrozenPrice`
  (note/frozen-actions.ts) — lewat komponen `MieProductDefaultRow` yang sudah ada.
- Query: `getMieProductDefaults`, `getMiePasarPrice`, `getFrozenPrice`.
- Tabel DB: `MieProductDefault` (Keriting/Lurus/Pangsit) dan `MieSetting` (pasar & frozen).

**Sengaja tidak diubah:** schema Prisma, `prisma/migrations`, `.env`, data produksi. `Product` /
`Category` / `Addon` tidak disentuh; kasir tidak diubah.

**Verifikasi:** `npm run lint` bersih.

---

## v2 — 14 Okt 2026

**Judul:** Section "Mi Mentah" (modal per kg) di Isi HPP (`/admin/hpp`).

**File diubah:**
- `src/app/admin/hpp/page.tsx` (baris 4–6 dan 18–35, file akhir 35 baris)
  - Tambah impor `getMieCosts`, `getMieProductDefaults`, `getMiePasarPrice` (baris 4–6).
  - Sebelum → sesudah: `Promise.all` semula `getHppItems`, `getHeaderNav`; sekarang ditambah tiga
    query modal/harga mi. Prop baru diteruskan ke `HppScreen` (`mieCosts`, `mieDefaults`,
    `miePasarPricePerKg`).
- `src/components/admin/hpp-screen.tsx` (baris 4–11 dan 110–127, file akhir 131 baris)
  - Tambah impor `MieCostKey`, `MieCosts`, `MIE_COST_ROWS`, `MieProductDefaults`, `MieCostAdminRow` (baris 4–11).
  - Tambah prop `mieCosts`, `mieDefaults`, `miePasarPricePerKg`; tambah map `mieSalePrice`
    (baris 40–45; harga jual default per jenis; Mi Pasar pakai harga pasar).
  - Tambah `<section>` **"Mi Mentah"** di **paling bawah** (setelah Add-on): 4 baris modal per kg
    dari `MIE_COST_ROWS` (Keriting Reguler, Keriting Mi Pasar, Lurus, Pangsit), masing-masing
    menampilkan untung/kg + persen.

**File dibuat:**
- `src/components/admin/mie-cost-admin-row.tsx` (104 baris) — editor modal per kg: input inline
  "Modal Rp … /kg" + tombol **Simpan selalu tampil** (nonaktif bila tak ada perubahan), untung/kg
  dan % dihitung live via `computeMarginPercent` (`src/lib/hpp/margin-math.ts`) terhadap harga jual
  default jenis itu; badge "Modal belum diisi" bila kosong, badge "Margin rendah" bila di bawah
  `LOW_MARGIN_THRESHOLD_PERCENT`. Menyimpan lewat `updateMieCostPerKg` (note/actions.ts).

**Keputusan margin:** untung = harga jual default − modal. Kalau harga jual default belum diisi →
tampil "—". Mi Pasar memakai `MieSetting.pasarPricePerKg`.

**Sengaja tidak diubah / dilewati:** **Mi Frozen tidak punya baris modal** — tidak ada field modal
Frozen di schema, jadi tidak ada field/migrasi baru yang dibuat (hanya harga jual yang diatur di v1).
Schema Prisma, `prisma/migrations`, `.env`, data produksi tidak disentuh.

**Verifikasi:** `npm run lint` bersih.

---

## v3 — 14 Okt 2026

**Judul:** Tombol "Simpan" selalu tampil di baris harga mi (bukan hanya saat berubah).

**File diubah:**
- `src/components/note/mie-product-default-row.tsx` (baris 85–89, file akhir 90 baris)
  - Sebelum: tombol Simpan hanya dirender saat `dirty` (`{dirty && (<Button …>)}`).
  - Sesudah: tombol Simpan **selalu dirender**, dengan `disabled={!dirty || saving}` — abu-abu/nonaktif
    bila belum ada perubahan, aktif bila ada perubahan. Pesan "Tersimpan ✓" tetap muncul sesaat setelah
    sukses, dan pesan error tetap tampil bila gagal.
  - Berlaku otomatis di dua tempat yang memakai komponen ini: `/note/produk` (Harga Mi Mentah: harga
    default, harga pasar, modal per kg, harga Frozen) dan section **Mi Mentah / Mi Frozen** di
    `/admin/menu` (dari v1).

**Tidak termasuk:** baris HPP warung (`hpp-item-row.tsx`) dan baris modal Mi Mentah baru
(`mie-cost-admin-row.tsx`, sudah selalu tampil sejak v2) — di luar lingkup Mi Mentah/Frozen atau
memang sudah sesuai.

**Sengaja tidak diubah:** schema Prisma, `prisma/migrations`, `.env`, data produksi.

**Verifikasi:** `npm run lint` bersih.

---

## v4 — 14 Okt 2026

**Judul:** Link harga default + perbaikan label "Mi Pasar" di Form Pesanan Baru (`/note/pesanan/baru`).

**File diubah:**
- `src/components/note/new-order-form.tsx` (file akhir 378 baris)
  - Impor: tambah `MIE_PASAR_LABEL` (baris 10–16).
  - **Perbaikan label** (baris 243–248): saat tombol "Mi Pasar" aktif, teks keterangan semula memakai
    `MIE_PRODUCT_LABEL[MIE_PASAR_PRODUCT_TYPE]` — karena `MIE_PASAR_PRODUCT_TYPE = "MIE_KERITING"`,
    yang tercetak selalu **"Mi Keriting"**. Sebelum → sesudah: `MIE_PRODUCT_LABEL[MIE_PASAR_PRODUCT_TYPE]`
    → `MIE_PASAR_LABEL` sehingga tertulis **"Mi Pasar"**.
  - **Link bantuan** (baris 314–321): di bawah baris "Ubah harga" (blok `productType !== "CUSTOM"`),
    tambah teks kecil "Ubah harga di sini hanya berlaku untuk pesanan ini." + tautan
    **"Ubah harga default di Manajemen Menu"** → `/admin/menu` (memakai `<Link>` yang sudah diimpor).
    Perilaku tombol "Ubah harga" per pesanan **tidak diubah**.

**Catatan auth (diverifikasi, tidak ada perubahan aturan):** `/note` (dan halaman form di dalamnya) dan
`/admin/menu` sama-sama OWNER-only lewat `getCurrentUser()` + `role !== "OWNER"` → `redirect("/kasir")`
(`src/app/note/pesanan/baru/page.tsx`, `src/app/admin/menu/page.tsx`). Jadi user yang membuka Note sudah
OWNER dan pasti bisa membuka link `/admin/menu`. Tidak ada pembatasan yang menghalangi.

**Sengaja tidak diubah:** schema Prisma, `prisma/migrations`, `.env`, data produksi; aturan auth.

**Verifikasi:** `npm run lint` bersih.

---

## v5 — 14 Okt 2026

**Judul:** Rapikan nomor baris catatan ini agar cocok dengan kondisi file akhir.

**File diubah:**
- `CATATAN_OPENCODE.md` saja — menyesuaikan referensi nomor baris di entri v1–v4 dengan hasil akhir
  tiap file (mis. `menu-admin-screen.tsx` = 154 baris, `mie-cost-admin-row.tsx` = 104 baris,
  `new-order-form.tsx` = 378 baris). Tidak ada perubahan kode di commit ini.

**Sengaja tidak diubah:** seluruh file kode, schema Prisma, `prisma/migrations`, `.env`, data produksi.

**Verifikasi:** tidak ada kode yang berubah; `npm run build` sudah dijalankan sukses sebelum commit ini.
