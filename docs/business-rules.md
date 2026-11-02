# Aturan bisnis warung

Konteks pengguna, menu & harga, add-on, ongkir. Baca sebelum mengubah menu, harga, add-on, layar kasir, atau apa pun yang menyangkut cara warung bekerja.

> Dipindah verbatim dari CLAUDE.md (2 Nov 2026). Judul bagian sengaja tidak diubah karena dirujuk dari komentar kode (`CLAUDE.md "<judul>"`). Rujukan "di atas/di bawah" ke bagian lain: cari judulnya di indeks CLAUDE.md.

## Konteks pengguna (penting untuk semua keputusan UI)

Yang menjaga warung adalah **karyawan berusia lanjut yang kurang terbiasa teknologi**. Implikasinya untuk setiap layar kasir:
- Langkah sesedikit mungkin, tombol sebesar mungkin (min. 48px).
- Hindari input teks/keyboard numerik sebagai jalur utama.
- Hindari wizard multi-langkah kecuali benar-benar perlu.

Buka/tutup shift dikerjakan **pemilik**, bukan karyawan — jadi layar shift boleh sedikit lebih kompleks daripada layar kasir harian.

**Kepadatan layar — Tahap 11.** Kasir dan Order Aktif (termasuk detail order & tambah item) dipakai sambil **berdiri melayani antrian** — dipadatkan supaya di tablet 10" landscape (1280×800) grid produk, keranjang, dan tombol aksi kelihatan sekaligus tanpa scroll untuk order ukuran normal (order yang sangat besar, >10 baris berbeda, tetap boleh scroll internal di panel keranjang — itu wajar, bukan yang disasar). Ukuran sentuh tombol **tidak pernah dikecilkan** (tetap ≥48px) — yang dipangkas cuma padding/gap/tinggi baris di sekitarnya. `ListRow` (`src/components/ui/list-row.tsx`) punya prop `dense` khusus untuk ini — dipakai HANYA di Order Aktif (`order-row.tsx`, unpaid-served list di `order-aktif-list.tsx`). Jangan pakai `dense` di layar lain (Piutang, Pesanan Terjadwal, Dashboard, laporan, Tutup Shift) — layar-layar itu dipakai duduk dan sengaja tetap lega.

## Menu & harga

- Menu = produk base + add-on (bukan produk terpisah per kombinasi).
- **Bakso Urat Ceker harga yang benar adalah 18.000** (Bakso 13.000 + Jenis Bakso "Urat" +3.000 + Topping "Ceker" +2.000). Menu cetak fisik salah ketik jadi 19.000 — sistem kita menghitung dari base+addon jadi otomatis benar (18.000), tidak perlu koreksi kode apa pun untuk ini.
- **Bakso di dalam mangkuk mi itu UPGRADE, bukan topping.** Grup **"Tambah Bakso"** (min 0, maks 1 — tampil sebagai radio, label "Opsional · Pilih 1") berisi Bakso +5.000, Bakso Urat +8.000, Bakso Telur +10.000; ketiganya saling menggantikan. Grup **"Topping Mie"** (maks tak terbatas — tetap stepper) tinggal Pangsit +2.000 dan Ceker +2.000, yang memang boleh lebih dari satu. Dua-duanya menempel ke **Mie Ayam, Pangsit Rebus, dan Ceker** sekaligus — aturannya sama untuk ketiganya, bukan cuma Mie Ayam. Dipisah oleh migrasi `20260918100000_bakso_upgrade_group_and_half_portions`, yang **memindahkan** baris `AddonOption` (id tidak berubah) supaya snapshot `OrderItemAddon`, `comboKey`/`ComboCache`, dan HPP yang sudah diisi tetap cocok. Produk **Bakso** sendiri tidak berubah: tetap "Jenis Bakso" + "Topping Bakso".
- **Bakso Kecil (3 biji) Rp5.000** (HPP estimasi 3.300 = 3 × 1.100, sejalan dengan harga bakso mentah 5.000 per 3 biji) dan **Bakso Setengah (4 biji) Rp8.000** (HPP estimasi 5.000 — ini semangkok lengkap dengan mi/sayur/kuah porsi setengah, jadi modalnya setengah dari Bakso biasa yang 10.000, bukan cuma harga baksonya; untung 3.000 seperti pola menu lain). Keduanya di kategori Makanan, di bawah baris "(bijian)". **Bakso Kecil tanpa add-on** (barang satuan, langsung masuk keranjang). **Bakso Setengah memakai grup "Topping Bakso"** (Pangsit/Ceker, stepper) seperti Bakso biasa karena semangkok lengkap — tapi **tidak** memakai "Jenis Bakso" (keputusan pemilik; migrasi `20260918120000_bakso_setengah_topping`).
- **"Tambah Bakso" maksimal 1 itu final** (upgrade paket, keputusan pemilik). Pelanggan yang mau bakso tambahan di luar paket dilayani kasir dengan produk bijian (Bakso Kecil / Bakso Urat (bijian) / Bakso Telur (bijian)) sebagai baris terpisah — harganya memang beda karena bukan harga paket. **Jangan** tambah produk Ceker bijian / Pangsit bijian: Pangsit Rebus dan Ceker sudah ada sebagai produk, ceker satuan lewat topping.
- **Grup "Jenis Bakso" opsional** (min 0, maks 1): isinya cuma "Urat" (+3.000) dan "Telur" (+5.000) — label pendek atas permintaan pemilik 21 Sep 2026 (sempat "Upgrade ke Urat"/"Upgrade ke Telur"; migrasi `20260921230000_bakso_jenis_short_labels` mengganti nama di tempat, id dan harga tetap; order lama tetap memakai nama snapshot saat dijual). Tidak memilih apa pun = Bakso biasa Rp13.000 — sengaja **tidak ada** opsi "Biasa", supaya pesanan bakso polos (yang paling sering) tidak butuh tap ekstra. Opsi "Biasa" lama di-soft-delete (`isActive=false`) oleh migrasi `20260917100200_bakso_jenis_optional`, yang juga mengganti nama "Urat"/"Telur" **di tempat** (id tetap, jadi `comboKey`, `ComboCache`, dan snapshot order lama tetap cocok). Saat migrasi dibuat, belum ada satu pun order yang memakai "Biasa", jadi tidak ada data historis yang perlu dipindah. Di layar add-on, opsi pilih-satu yang opsional bisa di-tap lagi untuk batal memilih.
- Halaman HPP: item dengan harga jual Rp0 menampilkan "Harga dasar, tidak ada markup", bukan angka untung/persentase yang membingungkan.
- Urutan kategori di layar kasir: Makanan, Minuman Racik, Kulkas, Lain-lain, Frozen, Es Krim (paling kanan). Tab kategori tanpa produk aktif tidak tampil (Frozen kosong sejak Mie Frozen dinonaktifkan).
- **Es Krim** (Diamond, dibeli per box, dijual per pcs, 7 produk awal per belanja 31 Okt 2026) adalah **satu-satunya produk dengan stok**. Harga jual, isi per box, harga beli per box, dan stok diatur di halaman **Stok Es Krim** (`/es-krim`), bukan di Manajemen Menu/Isi HPP; HPP = harga box ÷ isi. Detail: `docs/spec-es-krim.md`.
- Channel: Dine In, Bungkus, Antar — **tidak ada** GoFood/GrabFood/ShopeeFood. Pesanan dari aplikasi ojol tidak pernah diinput ke POS ini sama sekali.
- Meja: K1, K2 (kursi), L1, L2, L3 (lesehan) — label persis ini, bukan nomor 1-5.

## Ongkir (channel Antar)

- Rp1.000 per porsi kategori **Makanan saja** (bukan Minuman Racik/Kulkas/Lain-lain/Frozen), dihitung per qty bukan per baris.
- Baris terpisah di struk setelah subtotal.
- Tidak ada minimum ongkir — penolakan order kecil diputuskan manual oleh owner, bukan sistem.

## Yang belum diputuskan (tidak ada — semua item sudah dijawab per catatan di atas)
