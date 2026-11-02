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

- **Workflow:** `.github/workflows/db-backup.yml`, jadwal 20:00 UTC (03:00 WIB, jauh dari jam operasional), plus `workflow_dispatch` untuk jalan manual. Langkahnya: `pg_dump --schema=public --format=plain` lewat `BACKUP_DB_URL` (session pooler port 5432, sesuai permintaan pemilik — bukan transaction pooler 6543 yang dipakai runtime) → enkripsi dengan `age -r <public key>` → push ke `pos-mi-ayam-backups` (autentikasi lewat PAT) → hapus file `daily/*.sql.age` yang lebih tua dari 30 terbaru → hapus dump mentah dari disk runner.
- **Tiga secrets di `POS_Mi_Ayam` (Settings → Secrets and variables → Actions), diisi pemilik sendiri, tidak pernah lewat chat Claude Code:**
  1. `BACKUP_DB_URL` — nilai `DIRECT_URL` dari `.env` (session pooler, port 5432).
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

1. Ambil file `daily/backup-YYYYMMDD.sql.age` terbaru dari repo `pos-mi-ayam-backups`.
2. Buka dengan private key sendiri (tidak pernah lewat Claude Code): `age -d -i key.txt backup-YYYYMMDD.sql.age > backup.sql`.
3. Buat schema Postgres sementara untuk uji (pola yang sama dengan testing biasa — lihat kotak "DATABASE PRODUKSI" di atas): `CREATE SCHEMA restore_test;`
4. **Arahkan dump ke schema sementara itu, JANGAN restore langsung ke `public`** (itu akan bentrok dengan data live yang sudah ada — lihat catatan keamanan di bawah). `pg_dump --schema=public` menghasilkan pernyataan yang mengandalkan `SET search_path` dan sebagian merujuk `public.` secara eksplisit, jadi dua substitusi diperlukan sebelum dijalankan:
   ```
   sed -E \
     -e 's/^SET search_path = public, pg_catalog;$/SET search_path = restore_test, pg_catalog;/' \
     -e 's/"public"\./"restore_test"./g' \
     backup.sql > backup_restore_test.sql
   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f backup_restore_test.sql
   ```
5. Bandingkan: jumlah baris tiap tabel di `restore_test` harus sama dengan `public` (produksi), dan saldo pelanggan Mi Mentah (`MieCustomer`, dari jumlah `MieLedgerEntry` per pelanggan) serta Frozen (`FrozenCustomer`/`FrozenLedgerEntry`) di `restore_test` harus cocok dengan yang dihitung dari `public`.
6. Hapus schema sementara: `DROP SCHEMA restore_test CASCADE;` — dan hapus `backup.sql`/`backup_restore_test.sql` (bentuk mentah, tidak terenkripsi) dari disk.

**Kenapa langkah 4 aman biarpun substitusi nama schema-nya tidak sempurna:** `restore_test` selalu dibuat kosong lebih dulu, sedangkan `public` sudah berisi baris asli dengan primary key yang sama. Kalau karena suatu sebab pernyataan `INSERT`/`CREATE TABLE` tetap mengarah ke `public`, hasilnya BUKAN penimpaan diam-diam — `INSERT` akan langsung gagal dengan error duplicate-key (baris dengan id itu sudah ada), jadi pemulihan yang salah arah berhenti dengan error yang jelas, bukan merusak data produksi secara senyap.

**Catatan penting:** akun login (`auth.users`, dikelola Supabase Auth) **TIDAK ikut ter-backup** — dump ini cuma schema `public` (tabel aplikasi: Order, User (profil), Shift, MieCustomer, dst). Kalau suatu saat pindah project Supabase, akun OWNER/CASHIER harus dibuat ULANG manual lewat Supabase Auth (signup/invite), baru baris `public."User"` yang di-restore ini dicocokkan lewat `authUserId` ke akun baru itu — restore isi tabel saja tidak membuat siapa pun bisa login.

<!-- Setelah uji pemulihan pertama sungguhan dijalankan, catat di sini: tanggal, jumlah baris yang dicocokkan, dan hasil saldo Mi Mentah/Frozen. -->
