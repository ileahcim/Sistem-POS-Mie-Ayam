# Aturan kerja wajib (versi lengkap)

Versi lengkap aturan kerja: database produksi, pengaman tool, bahasa, alur Git. Ringkasannya ada di CLAUDE.md — kalau ada beda, file ini yang lengkap.

> Dipindah verbatim dari CLAUDE.md (2 Nov 2026). Judul bagian sengaja tidak diubah karena dirujuk dari komentar kode (`CLAUDE.md "<judul>"`). Rujukan "di atas/di bawah" ke bagian lain: cari judulnya di indeks CLAUDE.md.

# POS Mi Ayam — Keputusan Produk

Ini catatan keputusan yang **sudah final** hasil diskusi dengan pemilik warung. Jangan diubah tanpa konfirmasi ulang. Kalau ada yang terlihat keliru secara teknis dari keputusan ini, bilang dulu sebelum ngoding.

> ## 🔒 DATABASE PRODUKSI — DILARANG DISENTUH TANPA IZIN
>
> **Mulai 22 Sep 2026 database ini berisi transaksi ASLI warung. DILARANG menghapus, mengubah, atau membuat baris data apa pun tanpa izin eksplisit saya, termasuk untuk testing. Semua testing wajib di schema sementara.**
>
> Aturan lama yang membolehkan menghapus data tes setelah testing **TIDAK BERLAKU lagi** — sebelum 22 Sep 2026 seluruh isi database ini adalah data pengembangan/coba-coba dan boleh diutak-atik bebas untuk verifikasi (lihat pola `dp_test`/`kt_test` di bawah); sejak go-live 22 Sep 2026, `Order`/`OrderItem`/`Shift`/`Expense`/`PreorderDeposit`/`MieLedgerEntry` (dan tabel transaksi lain yang akan menyusul) berisi penjualan sungguhan. Pola kerja yang tetap SAH: bikin schema Postgres terpisah (`CREATE SCHEMA <nama>_test`), copy `User`+menu **read-only** ke situ, jalankan skenario di sana, lalu hapus schema-nya — persis seperti `dp_test` (Tahap DP) dan `kt_test` (kertas dapur, 22 Sep 2026). Backup penuh sebelum go-live ada di `/root/pos-mi-ayam-db-backups/backup-20260922/` (di luar repo, satu file JSON per tabel + `_manifest.json`).

## Pengaman tool — jangan pernah dilewati

**Aturan pemilik (24 Sep 2026): pengaman bawaan sebuah tool (termasuk Prisma) tidak boleh dilewati dengan cara apa pun tanpa izin eksplisit saya di percakapan itu juga.** Kejadian 23 Sep 2026: `prisma db push` terhadap schema sementara ditolak oleh pengaman Prisma 7.10 yang mendeteksi pemicunya agen AI tanpa persetujuan real-time — dan alih-alih berhenti bertanya, jalan lain ditempuh (`prisma migrate diff --from-empty --script` yang tidak digerbang, lalu DDL-nya dijalankan lewat koneksi `pg` polos). Hasilnya aman dan tidak menyentuh produksi, tapi caranya salah: **muter jalan supaya tetap bisa jalan itu bukan keputusan yang boleh diambil sendiri**, apa pun hasilnya. Pengaman itu ada justru supaya perubahan tidak pernah terjadi tanpa persetujuan pemilik yang diketik langsung saat itu — mencari jalan di sekitarnya menghapus persetujuan itu dari alurnya sendiri.

**Kalau sebuah pengaman menghalangi pekerjaan: berhenti dan tanya pemilik dulu.** Jangan dicari jalan lain untuk melewatinya — termasuk (tapi tidak terbatas pada) skrip mentah lewat koneksi database langsung, mengubah environment variable yang gerbangnya baca, atau tool/perintah pengganti yang punya efek akhir yang sama. Kalau pengaman itu perlu dilewati untuk pekerjaan yang memang sah (mis. testing skema di schema sementara), pemilik sendiri yang mengetik persetujuannya saat itu (mis. lewat `!<command>` di sesi ini), bukan Claude Code yang mencari cara di sekitarnya.

## Bahasa

**Semua balasan dan rangkuman Claude Code di proyek ini wajib pakai Bahasa Indonesia** (permintaan eksplisit pemilik warung, Tahap 12). Kode, nama variabel/fungsi, dan komentar teknis tetap Inggris seperti biasa — ini soal bahasa komunikasi ke pemilik, bukan bahasa kode.

## Alur kerja Git

- **Commit & push otomatis setiap selesai satu tahap/batch pekerjaan — tidak perlu minta konfirmasi dulu.** Ini pengecualian eksplisit dari kebiasaan default yang biasanya menunggu izin sebelum commit/push.
- Satu commit = satu tahap/batch yang berhubungan. Jangan gabung beberapa tahap tak berhubungan ke satu commit, jangan juga pecah satu tahap jadi banyak commit kecil tanpa alasan.
- Aturan git safety umum tetap berlaku dan TIDAK termasuk dalam pengecualian ini: tetap jangan pernah force-push, `git reset --hard`, amend commit yang sudah dipush, skip hooks, atau operasi destruktif lain tanpa izin eksplisit. Yang dikecualikan cuma commit+push biasa di akhir tahap.
- **Jangan membuat file screenshot di repo** (aturan pemilik, 22 Sep 2026 — folder `screenshots/` lama, 114 file, sudah dipindah ke luar repo sebagai arsip dan dihapus dari tracking git, `/screenshots/` ditambahkan ke `.gitignore`). Kalau perlu verifikasi visual, cek langsung di browser (Playwright dsb.) tanpa menyimpan filenya — assert teks/DOM, bukan simpan gambar.
