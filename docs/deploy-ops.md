# Deploy, PWA & Backup

PWA/service worker, deploy Vercel, backup GitHub Actions + prosedur restore. Baca sebelum mengubah sw.js, manifest, proxy.ts matcher, setting Vercel, atau workflow backup.

> Dipindah verbatim dari CLAUDE.md (2 Nov 2026). Judul bagian sengaja tidak diubah karena dirujuk dari komentar kode (`CLAUDE.md "<judul>"`). Rujukan "di atas/di bawah" ke bagian lain: cari judulnya di indeks CLAUDE.md.

## PWA — Tahap 12

Bisa di-install ke home screen (Android tablet Kasir, dan juga berfungsi kalau owner install dari iPhone untuk Dashboard) lewat `src/app/manifest.ts` (Web App Manifest; nama aplikasi **"Cipta Rasa"** — juga `<title>` dan judul Add to Home Screen) + ikon **PNG statis**: logo CTR berwarna (mangkok kuning + "CTR" merah) di atas latar putih SOLID (tidak pernah transparan), dibuat `scripts/make-app-icons.py` dari `reference/logo HD.png` — `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (logo di zona aman tengah supaya topeng lingkaran launcher tidak memotongnya), `src/app/apple-icon.png`, `src/app/icon.png`. Teks melengkung "CIPTA RASA"/"GROUP" sengaja tidak dipakai di ikon (tidak terbaca di ukuran kecil). Generator lama (teks "MA" lewat `next/og`) sudah dihapus. `display: "standalone"` (tanpa address bar). **Sengaja TIDAK ada `orientation` lock di manifest** — instalasi yang sama dipakai landscape di tablet warung (Kasir/Order Aktif) dan portrait di HP owner (Dashboard), mengunci salah satu akan merusak yang lain.

Service worker (`public/sw.js`) **cuma cache shell aplikasi** — cache-first untuk build asset `/_next/static/*` (content-hashed, jadi cache tidak pernah basi), network-first untuk navigasi halaman dengan fallback ke `/offline` (halaman statis, HANYA saat benar-benar tidak ada koneksi). **JANGAN PERNAH** menambah antrian transaksi offline / background sync untuk menyimpan order saat offline — itu keputusan eksplisit, di luar scope Tahap 12 sepenuhnya.

Batasan penting yang sengaja dijaga:
- **Service worker tidak pernah cache atau menyajikan salinan basi dari halaman data-nya sendiri** (Order Aktif, Kasir, Dashboard) — cuma `/offline` yang di-precache, dan itu pun halaman statis tanpa data sama sekali. Alasan: nomor antrian atau kas yang basi lebih berbahaya daripada layar "tidak ada koneksi" yang jujur, untuk mesin kasir.
- `/offline` sengaja pakai **inline style, bukan class Tailwind/komponen `Card`/`Button` biasa** — `cache.addAll(["/offline"])` cuma nge-cache HTML halaman itu sendiri, bukan file CSS yang direferensikannya (nama filenya di-hash per build, tidak bisa ditebak dari `sw.js`). Kalau file CSS itu kebetulan belum pernah ke-cache lewat pola cache-first di atas, halaman offline yang pakai class Tailwind akan tampil sebagai teks polos tanpa gaya sama sekali — sudah dibuktikan (dan diperbaiki) secara langsung dengan mensimulasikan offline lewat Playwright.
- `src/proxy.ts` (auth gate) **wajib** mengecualikan `/manifest.webmanifest`, `/sw.js`, `/icon`, `/apple-icon`, dan semua file `.png` (ikon ada di `/icons/*.png`, `/icon.png`, `/apple-icon.png`; logo di `/assets/*.png`) dari matcher-nya — browser mengambil aset-aset ini lepas dari status login (bahkan dari halaman `/login` itu sendiri), dan registrasi service worker **gagal total** kalau responsnya redirect (bukan 200 asli) atau Content-Type-nya salah. `/offline` juga harus selalu bisa diakses langsung tanpa pernah di-redirect balik ke `/` walau user sedang login — beda dari `/login` yang memang harus redirect kalau sudah login.

### Deploy Vercel

Project: `leahcim-team/pos-mi-ayam` (akun `ileahcim`, plan Hobby). Production: `https://pos-mi-ayam.vercel.app`. Environment variable production sudah dipasang (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — nilainya sama dengan `.env` dev sampai checklist go-live poin 1 (pisah database) dikerjakan. **Auto-deploy per push ke `main` sengaja dibiarkan menyala** (keputusan pemilik) — lihat poin 6 checklist go-live untuk kapan mempertimbangkan mematikannya.

Dua jebakan yang sudah kejadian nyata sekali saat setup awal, dicatat supaya tidak terulang kalau project di-deploy ulang dari nol:
- **Project yang dibuat lewat `vercel project add` (bukan lewat alur import dashboard) tidak otomatis punya Framework Preset ke Next.js** — build tetap "sukses" (log build tetap menjalankan `next build` dan menampilkan tabel Route yang benar), tapi diam-diam jatuh ke builder `@vercel/static-build` generik yang cuma menyalin folder `public/` sebagai file statis dan **tidak membuat satu serverless function pun** — hasilnya semua halaman (termasuk `/login`) 404 di production walau build "sukses" dan deployment status "Ready". Terbukti lewat `vercel build` lokal: `.vercel/output/` cuma berisi `static/`, tidak ada folder `functions/`, dan `builds.json` menyebut `"detectedFramework": {"status": "skipped"}` + `"require": "@vercel/static-build"`. Perbaikannya: `vercel project update <nama> --framework nextjs --yes` lalu deploy ulang — setelah itu tabel Route yang sama menghasilkan 21 function sungguhan.
- **Project baru di tim ini otomatis kena "Deployment Protection" (SSO Vercel)** untuk semua domain `*.vercel.app` termasuk production (`all_except_custom_domains`) — URL production tidak bisa diakses sama sekali tanpa login ke akun Vercel tim, jadi tablet kasir pasti gagal connect kalau ini tidak dimatikan. Dimatikan lewat `vercel project protection disable <nama> --sso` (butuh konfirmasi eksplisit dari pemilik karena ini melemahkan lapisan akses — keamanan aplikasi tetap dijaga oleh login username/password POS sendiri, bukan lapisan SSO Vercel ini).

**Sambungan GitHub untuk auto-deploy belum berhasil dibuat lewat CLI** (`vercel git connect` gagal dengan pesan generic "Failed to connect... Make sure you have access to the repository", walau repo publik dan bisa diakses) — kemungkinan besar karena Vercel GitHub App belum pernah diinstal/diotorisasi untuk akun `ileahcim` di GitHub, dan itu langkah consent yang cuma bisa diselesaikan lewat UI (browser), tidak lewat token API. Kalau perlu diulang: buka `https://vercel.com/leahcim-team/pos-mi-ayam/settings/git` dan klik "Connect Git Repository", ikuti alur otorisasi GitHub yang muncul.

## Backup & Pemulihan — dibangun 24 Sep 2026

Plan Supabase gratis tidak punya backup otomatis, dan satu-satunya backup yang ada sebelumnya (`/root/pos-mi-ayam-db-backups/backup-20260922/`) statis, tidak pernah diperbarui. Solusi paling sederhana yang memenuhi semua syarat pemilik (otomatis tanpa laptop, di luar Supabase, tidak bisa diakses publik meski repo `POS_Mi_Ayam` public, dienkripsi, 30 hari terakhir, ada notifikasi kalau gagal, lewat session pooler port 5432): **GitHub Actions terjadwal di repo ini**, men-dump schema `public`, **mengenkripsinya dengan `age`** (asymmetric — cuma pemilik private key yang bisa membukanya, runner CI cuma pegang public key jadi TIDAK BISA membuka hasilnya sendiri walau secrets bocor), lalu men-push hasilnya ke **repo GitHub terpisah dan PRIVATE**, `ileahcim/pos-mi-ayam-backups` (dibuat 24 Sep 2026, cuma berisi file `daily/backup-YYYYMMDD.sql.age` + README, tidak ada kode/kredensial di situ). Kenapa ini paling sederhana: tidak ada akun/layanan pihak ketiga baru — cuma GitHub, yang pemilik sudah pakai — dan **notifikasi gagal otomatis dari GitHub sendiri** (email ke pemilik repo saat scheduled workflow gagal, perilaku bawaan, tidak perlu diatur).

- **Workflow:** `.github/workflows/db-backup.yml`, jadwal 20:00 UTC (03:00 WIB, jauh dari jam operasional; GitHub sering menunda 2-4 jam), plus `workflow_dispatch` untuk jalan manual. Langkahnya (sejak 2 Nov 2026): cek ketiga secret terisi → checkout repo backup → install `postgresql-client` + `age` → cek versi `pg_dump` ≥ versi server → `pg_dump --schema=public --format=plain --no-owner --no-privileges` lewat `BACKUP_DB_URL` (session pooler port 5432, `PGSSLMODE=require`) → **validasi dump** (ukuran > 10 KB, penutup "dump complete" ada, 12 tabel kunci ada, `User`/`Product`/`_prisma_migrations` tidak kosong) → enkripsi `age -r <public key>` jadi `daily/backup-YYYYMMDD.sql.age` (**tanggal WIB saat backup dibuat**, isinya data s/d malam sebelumnya) → push ke `pos-mi-ayam-backups` → hapus yang lebih tua dari 30 terbaru → **uji restore otomatis** ke Postgres 18 sementara di dalam runner (service container, bukan Supabase), jumlah baris setiap tabel dicocokkan dengan dump → hapus dump mentah dari runner. Uji restore jalan SESUDAH file tersimpan: kalau uji restore gagal, file tetap tersimpan tapi run jadi merah (email terkirim).
- **Repo ini PUBLIC → log Actions bisa dibaca siapa pun.** Workflow sengaja hanya mencetak versi, ukuran file, nama tabel (sudah ada di `schema.prisma`), dan hasil cocok/tidak cocok. Tidak ada jumlah baris per tabel, isi data, atau connection string. Pertahankan aturan ini kalau mengubah workflow.
- **Tiga secrets di repo `ileahcim/Sistem-POS-Mie-Ayam` (nama baru repo `POS_Mi_Ayam`; Settings → Secrets and variables → Actions → tab "Secrets" → "New repository secret" — BUKAN environment "Production" milik Vercel), diisi pemilik sendiri, tidak pernah lewat chat Claude Code:**
  1. `BACKUP_DB_URL` — nilai `DIRECT_URL` dari `.env` (session pooler, port 5432). Di dashboard Supabase: tombol **Connect** (atas) → **Session pooler** → URI `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`, `[YOUR-PASSWORD]` diganti password database. **Jangan** pakai "Direct connection" (`db.<ref>.supabase.co`) — di plan gratis itu hanya IPv6 dan runner GitHub tidak punya IPv6, jadi koneksinya gagal. **Jangan** pakai port 6543 (transaction pooler) — workflow menolaknya.
  2. `BACKUP_AGE_PUBLIC_KEY` — public key `age` (baris `age1...` dari `age-keygen`). Ini AMAN dibagikan/disimpan di mana saja — cuma bisa dipakai untuk mengenkripsi, tidak untuk membuka.
  3. `BACKUP_REPO_TOKEN` — Personal Access Token (fine-grained, scope Contents: Read and write, cuma untuk repo `pos-mi-ayam-backups`) — dibuat lewat GitHub web UI (Settings → Developer settings → Personal access tokens), tidak bisa dibuat lewat CLI/API atas nama sendiri.
  - **Private key `age`** (baris `AGE-SECRET-KEY-...` dari `age-keygen`) **TIDAK PERNAH masuk GitHub Secrets ataupun chat mana pun** — itu satu-satunya kunci untuk MEMBUKA backup, jadi disimpan pemilik sendiri di luar sistem ini (mis. password manager). Kalau hilang, seluruh backup yang sudah ada tidak bisa dibuka lagi — tidak ada cara pulihkan kuncinya.
- **Langkah setup (sekali saja, oleh pemilik):**
  1. Install `age` (mis. `brew install age` / `sudo apt install age`), jalankan `age-keygen -o key.txt` — simpan `key.txt` di tempat aman (BUKAN di repo mana pun). Baris `# public key: age1...` yang tercetak itu yang dipakai untuk secret `BACKUP_AGE_PUBLIC_KEY`.
  2. Buat fine-grained PAT khusus repo `pos-mi-ayam-backups`, scope Contents read/write, masa berlaku sesuai selera (bisa "no expiration" karena ini automation, atau diperpanjang manual tiap tahun).
  3. Isi ketiga secrets di atas ke repo `POS_Mi_Ayam`.
  4. Jalankan workflow manual sekali (tab Actions → "Backup database harian" → "Run workflow") untuk memastikan jalan, lalu cek file barunya muncul di `pos-mi-ayam-backups`.
- **Rekomendasi soal repo public** (pemilik yang putuskan, belum diubah): jadikan `POS_Mi_Ayam` **private**. Tidak ada biaya nyata pada skala pemakaian sekarang — Vercel Hobby men-deploy repo private sama saja dengan public, dan jatah 2.000 menit Actions/bulan gratis GitHub jauh lebih dari cukup untuk satu backup harian ~1-2 menit (~30-60 menit/bulan). Untungnya: riwayat commit publik (termasuk kemungkinan kecil rahasia yang pernah kecolongan ter-commit di masa lalu) dan detail logika bisnis (harga, rumus diskon) tidak lagi bisa dibaca siapa pun yang menemukan link repo-nya. Tidak ada downside operasional yang ditemukan.

### Prosedur Pemulihan (restore) — langkah demi langkah

**Uji pemulihan WAJIB dilakukan sekali setelah backup pertama berhasil** (backup yang belum pernah dicoba dipulihkan = sama saja tidak punya backup) — lihat catatan hasil ujinya sendiri di bawah setelah dijalankan.

Workflow sudah menguji restore setiap hari (langkah "Restore test"), tapi dengan dump mentah **sebelum** dienkripsi — runner tidak pernah punya private key. Yang belum terbukti oleh CI hanya satu hal: **file `.age` bisa dibuka dengan private key pemilik**. Itu yang dibuktikan uji manual di bawah, sekali saja, oleh pemilik.

**Uji pemulihan — di Postgres sementara di laptop, TIDAK PERNAH ke Supabase:**

1. Ambil file `daily/backup-YYYYMMDD.sql.age` terbaru dari repo `pos-mi-ayam-backups`.
2. Buka dengan private key sendiri (tidak pernah lewat Claude Code): `age -d -i key.txt backup-YYYYMMDD.sql.age > backup.sql`. Berhasil terbuka = kuncinya benar.
3. Jalankan Postgres sementara: `docker run -d --name restore-test -e POSTGRES_PASSWORD=restoretest -p 55432:5432 postgres:18`, lalu `export R=postgresql://postgres:restoretest@localhost:55432/postgres`.
4. Siapkan lalu restore (sama persis dengan langkah CI):
   ```
   psql "$R" -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;"
   psql "$R" -c "DROP SCHEMA public CASCADE;"
   grep -q '^CREATE SCHEMA public;' backup.sql || psql "$R" -c "CREATE SCHEMA public;"
   psql "$R" -v ON_ERROR_STOP=1 -f backup.sql
   ```
5. Cek: buka beberapa tabel (`psql "$R" -c 'SELECT count(*) FROM public."Order"'`, `"MieCustomer"`, `"FrozenLedgerEntry"`), angkanya masuk akal untuk tanggal backup itu.
6. Bersihkan: `docker rm -f restore-test` dan hapus `backup.sql` (bentuk mentah, tidak terenkripsi).

**Kenapa tidak lagi "restore ke schema `restore_test` di database produksi"** (prosedur lama, 24 Sep 2026): `pg_dump` versi modern menulis setiap nama dengan schema lengkap (`public."Order"`) dan memakai `set_config('search_path', '', false)`, bukan `SET search_path = public, pg_catalog;` atau `"public".`. Dua `sed` di prosedur lama itu tidak cocok dengan baris mana pun, jadi semua pernyataan tetap mengarah ke `public` produksi. Memang akan berhenti dengan error "already exists", bukan menimpa data, tapi tetap salah arah. Postgres sementara di luar Supabase menghilangkan risiko itu sepenuhnya.

**Pemulihan sungguhan (database hilang/rusak):** keputusan pemilik saat itu, jangan dikerjakan sendiri. Bentuk normalnya: project Supabase baru yang KOSONG → langkah 2 dan 4 di atas dengan `R` = session pooler project baru → `prisma migrate resolve` TIDAK perlu karena tabel `_prisma_migrations` ikut ter-backup → buat ulang akun Auth (lihat catatan di bawah) → ganti `DATABASE_URL`/`DIRECT_URL` di Vercel.

**Catatan penting:** akun login (`auth.users`, dikelola Supabase Auth) **TIDAK ikut ter-backup** — dump ini cuma schema `public` (tabel aplikasi: Order, User (profil), Shift, MieCustomer, dst). Kalau suatu saat pindah project Supabase, akun OWNER/CASHIER harus dibuat ULANG manual lewat Supabase Auth (signup/invite), baru baris `public."User"` yang di-restore ini dicocokkan lewat `authUserId` ke akun baru itu — restore isi tabel saja tidak membuat siapa pun bisa login.

### Insiden: backup gagal setiap hari 23 Sep – 1 Nov 2026 (diperbaiki 2 Nov 2026)

- **Gejala:** email "Run failed: Backup database harian" setiap hari. Ke-40 run terjadwal gagal dalam ±7 detik. Folder `daily/` di `pos-mi-ayam-backups` cuma berisi `.gitkeep`, artinya **tidak pernah ada satu pun backup sampai 2 Nov 2026**.
- **Penyebab pasti** (dari `gh run view <id> --log-failed`, run pertama 23 Sep sampai run terakhir 1 Nov, error yang sama): langkah pertama (`actions/checkout`) berhenti dengan `##[error]Input required and not supplied: token`. `gh secret list` di repo ini kosong, dan environment "Production" (dibuat Vercel) juga tidak punya secret. **Ketiga secret (`BACKUP_DB_URL`, `BACKUP_AGE_PUBLIC_KEY`, `BACKUP_REPO_TOKEN`) tidak pernah diisi**: langkah setup no. 3 di atas belum pernah dijalankan. Bukan masalah versi pg_dump, pooler, atau SSL, karena run tidak pernah sampai ke langkah itu.
- **Bukti run sukses pertama:** 2 Nov 2026 ±20.11 WIB, run manual `41450835602` (workflow_dispatch, hijau). Isinya:
  - Server Postgres 17, pg_dump 18.6;
  - dump 1.566.654 byte berisi 24 tabel (23 model `schema.prisma` + `_prisma_migrations`, lengkap);
  - tersimpan `daily/backup-20261102.sql.age` (1.567.222 byte, commit `77d03e7` di `pos-mi-ayam-backups`);
  - "Uji restore OK: 24 tabel, jumlah baris semuanya cocok dengan dump".
  - **Belum dibuktikan:** file `.age` bisa dibuka dengan private key pemilik (uji manual langkah 2 di atas).
- **Perbaikan:** pemilik mengisi ketiga secret (2 Nov 2026). Workflow sekalian dikeraskan (lihat "Workflow" di atas), karena langkah-langkah sesudah checkout belum pernah sekali pun teruji:
  - cek secret di awal dengan pesan yang menyebut nama secret yang kosong, dan tolak port 6543 serta private key yang salah tempel;
  - cek versi pg_dump dibanding server;
  - validasi dump;
  - uji restore otomatis;
  - `actions/checkout@v5` (v4 memicu peringatan Node 20 deprecated);
  - nama file memakai tanggal WIB.

**Cara cek backup berhasil:**
1. Tab Actions → "Backup database harian": run terbaru centang hijau. Atau dari terminal: `gh run list --workflow=db-backup.yml -L 5`.
2. Buka log run itu. Langkah "Validate dump" mencetak ukuran dump dan daftar tabel, "Store backup" mencetak `Tersimpan: daily/backup-YYYYMMDD.sql.age — total N file backup`, dan "Restore test" mencetak `Uji restore OK: N tabel, jumlah baris semuanya cocok dengan dump`.
3. Repo `pos-mi-ayam-backups` → folder `daily/`: ada file tanggal hari ini, ukurannya tidak nol. Atau dari terminal: `gh api repos/ileahcim/pos-mi-ayam-backups/contents/daily -q '.[] | "\(.name) \(.size)"'`.
4. Tidak ada email gagal. **Email gagal = cek hari itu juga**; pesan `::error::` di log langsung menyebut penyebabnya.

<!-- Setelah uji pemulihan pertama sungguhan dijalankan, catat di sini: tanggal, jumlah baris yang dicocokkan, dan hasil saldo Mi Mentah/Frozen. -->
