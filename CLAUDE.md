@AGENTS.md

# POS Mi Ayam — Keputusan Produk

Ini catatan keputusan yang **sudah final** hasil diskusi dengan pemilik warung. Jangan diubah tanpa konfirmasi ulang. Kalau ada yang terlihat keliru secara teknis dari keputusan ini, bilang dulu sebelum ngoding.

## Alur kerja Git

- **Commit & push otomatis setiap selesai satu tahap/batch pekerjaan — tidak perlu minta konfirmasi dulu.** Ini pengecualian eksplisit dari kebiasaan default yang biasanya menunggu izin sebelum commit/push.
- Satu commit = satu tahap/batch yang berhubungan. Jangan gabung beberapa tahap tak berhubungan ke satu commit, jangan juga pecah satu tahap jadi banyak commit kecil tanpa alasan.
- Aturan git safety umum tetap berlaku dan TIDAK termasuk dalam pengecualian ini: tetap jangan pernah force-push, `git reset --hard`, amend commit yang sudah dipush, skip hooks, atau operasi destruktif lain tanpa izin eksplisit. Yang dikecualikan cuma commit+push biasa di akhir tahap.

## Zona waktu

Warung berlokasi di Indonesia (WIB, UTC+7, tidak ada daylight saving). **Setiap kode server yang mengelompokkan per hari, menghitung rentang tanggal, menentukan batas awal/akhir hari, atau menampilkan tanggal/jam ke pengguna WAJIB lewat `src/lib/timezone.ts`** (`localDateStr`, `localTimeStr`, `localDateParts`, `mondayOfLocalWeek`, `formatId`) — jangan pernah `date.getHours()`/`getFullYear()`/dst secara langsung, jangan pernah `date.toISOString().slice(...)`, dan jangan pernah `new Intl.DateTimeFormat(...)` tanpa `timeZone` eksplisit.

**Kenapa ini bukan cuma soal gaya kode:** `getHours()` dkk dan `Intl.DateTimeFormat` tanpa `timeZone` eksplisit itu benar HANYA karena kebetulan OS jam server-nya sudah Asia/Jakarta. Begitu di-deploy ke Vercel (Tahap 12), serverless function-nya jalan di UTC — kode yang sama, tanpa berubah sebaris pun, diam-diam menggeser semua jam yang ditampilkan mundur 7 jam (shift tutup jam 20:00 WIB akan tertampil "13:00"), dan transaksi jam 00:00-06:59 WIB bisa masuk hitungan omzet hari SEBELUMNYA (karena jam segitu masih hari sebelumnya kalau dibaca sebagai UTC). `src/lib/timezone.ts` selalu benar di lingkungan apa pun karena memaksa `timeZone: "Asia/Jakarta"` eksplisit ke Intl API, tidak pernah bergantung ke default runtime — sudah dibuktikan dengan menjalankan logikanya di bawah `TZ=UTC` dan `TZ=Asia/Jakarta` sekaligus, hasilnya identik persis.

Yang **tidak** perlu lewat helper ini (aman secara desain, bukan kebetulan):
- Window rolling N-hari (`Date.now() - N*24*60*60*1000`, dipakai combo cache Tahap 10 & dashboard Tahap 11) — ini pengurangan durasi murni terhadap instant absolut, bukan operasi batas kalender, jadi timezone tidak relevan sama sekali di sini.
- Perbandingan instant-vs-instant (`scheduledFor > now`, dst) — sama, tidak ada aritmetika kalender.
- Penulisan timestamp mentah (`paidAt: new Date()`, `voidedAt: new Date()`, dst) — kolom `timestamptz` menyimpan instant absolut, selalu benar tanpa ambiguitas; zona waktu cuma relevan saat instant itu nanti DITAMPILKAN atau DIKELOMPOKKAN per hari.
- Input tanggal/jam dari kasir di layar (`preorder-screen.tsx`'s `new Date(\`${date}T${time}\`)`) — ini jam dinding perangkat tablet itu sendiri, bukan kode server; asumsinya OS tablet memang di-set ke WIB (sama seperti asumsi struk tercetak butuh printer nyala), bukan sesuatu yang bisa "dipusatkan" lewat kode.

Diaudit ulang Tahap 12: satu-satunya bug nyata yang ketemu adalah nama file export Excel (`toISOString().slice()`, sudah diperbaiki) — semua pengelompokan kalender lain (grafik omzet, window 30 hari menu populer/dashboard) sudah lolos audit atau sudah dipindah ke helper terpusat ini.

## Konteks pengguna (penting untuk semua keputusan UI)

Yang menjaga warung adalah **karyawan berusia lanjut yang kurang terbiasa teknologi**. Implikasinya untuk setiap layar kasir:
- Langkah sesedikit mungkin, tombol sebesar mungkin (min. 48px).
- Hindari input teks/keyboard numerik sebagai jalur utama.
- Hindari wizard multi-langkah kecuali benar-benar perlu.

Buka/tutup shift dikerjakan **pemilik**, bukan karyawan — jadi layar shift boleh sedikit lebih kompleks daripada layar kasir harian.

**Kepadatan layar — Tahap 11.** Kasir dan Order Aktif (termasuk detail order & tambah item) dipakai sambil **berdiri melayani antrian** — dipadatkan supaya di tablet 10" landscape (1280×800) grid produk, keranjang, dan tombol aksi kelihatan sekaligus tanpa scroll untuk order ukuran normal (order yang sangat besar, >10 baris berbeda, tetap boleh scroll internal di panel keranjang — itu wajar, bukan yang disasar). Ukuran sentuh tombol **tidak pernah dikecilkan** (tetap ≥48px) — yang dipangkas cuma padding/gap/tinggi baris di sekitarnya. `ListRow` (`src/components/ui/list-row.tsx`) punya prop `dense` khusus untuk ini — dipakai HANYA di Order Aktif (`order-row.tsx`, unpaid-served list di `order-aktif-list.tsx`). Jangan pakai `dense` di layar lain (Piutang, Pesanan Terjadwal, Dashboard, laporan, Tutup Shift) — layar-layar itu dipakai duduk dan sengaja tetap lega.

## Menu & harga

- Menu = produk base + add-on (bukan produk terpisah per kombinasi).
- **Bakso Urat Ceker harga yang benar adalah 18.000** (Bakso 13.000 + Jenis "Urat" +3.000 + Topping "Ceker" +2.000). Menu cetak fisik salah ketik jadi 19.000 — sistem kita menghitung dari base+addon jadi otomatis benar (18.000), tidak perlu koreksi kode apa pun untuk ini.
- Urutan kategori di layar kasir: Makanan, Minuman Racik, Kulkas, Lain-lain, Frozen (paling bawah).
- Channel: Dine In, Bungkus, Antar — **tidak ada** GoFood/GrabFood/ShopeeFood. Pesanan dari aplikasi ojol tidak pernah diinput ke POS ini sama sekali.
- Meja: K1, K2 (kursi), L1, L2, L3 (lesehan) — label persis ini, bukan nomor 1-5.

## Order & status

- Semua order defaultnya **belum dibayar**. Bayar di muka adalah pengecualian, bukan alur utama.
- `servedAt` (makanan keluar) dan `paidAt` (sudah bayar) adalah dua hal independen — order bisa disajikan duluan lalu dibayar belakangan, atau sebaliknya.
- Nomor antrian: otomatis, reset per shift, digenerate **server-side** (atomic increment di baris Shift) supaya dua device tidak bentrok.
- Nama tamu: **opsional**, field bebas (`Order.customerName`) — bisa diisi nama orang atau catatan lain yang berguna buat kasir, tidak wajib diisi.
- Order berstatus `PAID` beku, tidak bisa diedit. Kalau pelanggan nambah setelah bayar, itu **order baru**, bukan tambahan ke order lama.
- Void wajib isi alasan, hanya role **OWNER**.
- Harga, nama produk, dan HPP di-snapshot ke `OrderItem` saat transaksi — laporan lama tidak pernah dihitung ulang dari tabel Product.
- `costPrice` diisi manual oleh owner (estimasi). Tidak ada sistem stok/BOM — di luar scope.

## Split payment ("Pisahkan & Bayar") — diputuskan, belum dibangun

Kasus rombongan yang duduk di satu meja tapi mau bayar terpisah:
- **Tidak** ada fitur gabung order / pindah meja.
- Ada tombol **"Pisahkan & Bayar"** di halaman order: kasir centang sebagian item → sistem memindahkan item tercentang ke **order baru** dengan nomor antrian = nomor asli + suffix huruf (contoh: order #18 dipisah jadi `18-A`) → order baru itu langsung masuk alur pembayaran.
- Order induk tetap terbuka dengan sisa item yang tidak dipindah.
- Aturan keras: **satu order = satu pembayaran = satu struk**. Jangan pernah membuat order yang bisa dibayar berkali-kali.
- Ini kasus jarang — jangan sampai menambah langkah di alur pembayaran normal (single order, bayar sekali) untuk mengakomodasi ini.
- Belum diimplementasi — bangun saat diminta, bukan sekarang.

## Ongkir (channel Antar)

- Rp1.000 per porsi kategori **Makanan saja** (bukan Minuman Racik/Kulkas/Lain-lain/Frozen), dihitung per qty bukan per baris.
- Baris terpisah di struk setelah subtotal.
- Tidak ada minimum ongkir — penolakan order kecil diputuskan manual oleh owner, bukan sistem.

## Struk & printer

- Print **hanya sekali**, saat pembayaran (MockPrinter sekarang, printer fisik menyusul).
- Item dengan nama + add-on identik digabung jadi satu baris dengan qty.
- Khusus channel Antar: tombol **"Print Daftar"** terpisah, dipakai **sebelum** bayar — kotak centang kosong di kiri tiap nama menu, qty dicetak besar, **tanpa harga/total** (ini daftar packing, bukan bukti bayar). Dibangun Tahap 8.
- Nama warung, alamat, telepon, footer struk **selalu** dari tabel `Setting` (singleton), tidak pernah di-hardcode di kode.

## Pembayaran

- **Satu tap langsung selesai**: kasir pilih metode — **Cash** atau **QRIS** saja, tidak ada Transfer — lalu tap "Bayar". Tidak ada input nominal uang sama sekali, tidak ada keyboard numerik di jalur ini.
- Tidak ada kalkulasi kembalian untuk order normal — `cashReceived` di server dianggap sama dengan total, dan struk tidak pernah mencetak baris "Kembali".
- Total selalu dihitung ulang di server saat pembayaran, tidak pernah percaya angka dari client.

## Order Aktif — timer

- Estimasi waktu masak = `prepBaseMinutes + prepMinutesPerPortion × porsi-yang-perlu-dimasak` (porsi dihitung dari kategori Makanan + Minuman Racik saja; Kulkas/Lain-lain/Frozen tidak dihitung karena tidak perlu prep).
- Oranye saat elapsed ≥ estimasi, merah saat elapsed ≥ 2× estimasi.
- `prepBaseMinutes` (default 4) dan `prepMinutesPerPortion` (default 1) disimpan di tabel `Setting`, harus bisa diubah dari halaman admin (belum dibangun — Tahap 11).
- Badge "Borongan" (order dengan total qty > 10) tetap tampil sebagai penanda visual, tapi warnanya sekarang ikut rumus di atas juga (tidak lagi otomatis netral/dikecualikan) — order borongan besar otomatis dapat toleransi waktu lebih lama karena porsinya lebih banyak.

## Pre-order

Order bisa dikasih tanggal+jam kirim (`Order.scheduledFor`). Sebelum hari H, order ini hidup di tab terpisah "Pesanan Terjadwal" (`/pesanan-terjadwal`), bukan Order Aktif — begitu `scheduledFor` terlewati, otomatis pindah ke Order Aktif seperti order biasa, tanpa langkah "aktivasi" apa pun (dua query di server cuma cermin satu sama lain dari cutoff waktu yang sama).

Dua aturan keras hasil diskusi dengan pemilik warung:

1. **Pre-order boleh dibuat TANPA shift terbuka.** Pesanan borongan biasanya masuk lewat WhatsApp malam hari saat warung sudah tutup — jadi pengecekan "harus ada shift terbuka" yang berlaku untuk order biasa (`saveOrder`) **tidak berlaku** untuk pembuatan pre-order (`savePreOrder`). Konsekuensi teknis: satu-satunya layar yang pasti bisa dibuka tanpa shift adalah `/shift/buka` (rantai redirect `/` → `/kasir` → `/shift/buka` memaksa lewat situ kalau belum ada shift), jadi link ke "Pesanan Terjadwal" wajib ada di layar itu juga, bukan cuma di Kasir/Order Aktif — kalau tidak, pre-order jadi tidak bisa dijangkau sama sekali malam hari.
2. **Pre-order TIDAK ter-attach ke shift yang kebetulan aktif saat dibuat.** `shiftId` dan `queueNumber` (keduanya nullable di skema, khusus untuk kasus ini) tetap `null` sampai pesanan itu **dibayar** — `payOrder` yang mengisi keduanya sekaligus, atomik, ke shift yang terbuka **saat pembayaran terjadi** (pola atomic-increment yang sama seperti `saveOrder`). Dengan begitu penjualannya selalu masuk ke shift hari pengiriman/pembayaran, bukan shift hari pemesanan (yang mungkin malah tidak ada shift sama sekali). Kalau pre-order jatuh tempo tapi belum dibayar dan tidak ada shift terbuka, `payOrder` menolak dengan pesan "Buka shift dulu sebelum membayar pre-order ini." — tidak mengubah data apa pun.

Konsekuensi dari aturan 2: pre-order yang belum dibayar **tidak boleh memblokir penutupan shift hari ini** — yang memblokir cuma order hari berjalan yang `shiftId`-nya sama dengan shift yang mau ditutup. Ini otomatis benar tanpa filter tambahan: `getUnpaidOrdersForShift(shiftId)` (dipakai `closeShift`) sudah query `where: { shiftId, status: "OPEN" }` sejak awal — pre-order yang `shiftId`-nya masih `null` otomatis tidak pernah masuk hitungan sampai dia benar-benar dibayar.

Nama pemesan (`customerName`) **wajib** diisi khusus untuk pre-order (beda dari order biasa yang opsional) — sebelum dibayar, pre-order belum punya nomor antrian sama sekali, jadi nama adalah satu-satunya cara staf mengenali pesanan itu di layar.

## Shift & kas

- Transaksi diblokir kalau belum ada shift terbuka — kecuali pembuatan pre-order, lihat "Pre-order" di atas.
- `expectedCash` **tidak boleh** tampil ke kasir sebelum kasir input hitungan fisik uang (`countedCash`) — ini sengaja, supaya angka selisih (`difference`) tetap punya arti.
- Semua angka shift (`cashSales`, `nonCashSales`, `expenseTotal`, `expectedCash`, `countedCash`, `difference`) **dibekukan** saat tutup shift, tidak pernah dihitung ulang dari data live setelahnya (void minggu depan tidak boleh mengubah laporan shift yang sudah tutup).
- **Pengeluaran dicatat SEBELUM hitung uang fisik**, sebagai langkah eksplisit dalam alur tutup shift — bukan diandalkan dari input real-time selama shift jalan. Alasan: di lapangan pengeluaran biasanya dicatat di kertas dulu, baru diinput belakangan; kalau tidak dimasukkan sebelum hitung fisik, `expectedCash` salah dan selisih kas jadi alarm palsu tiap hari. Menu input pengeluaran harian (real-time) tetap ada sebagai opsi, tapi alur tutup shift punya langkah eksplisit "input pengeluaran dulu" sebelum "hitung uang fisik".
- Tutup shift diblokir kalau masih ada order berstatus `OPEN` (belum dibayar). Untuk tiap order yang belum selesai, kasir pilih salah satu:
  - **Batalkan** — untuk order salah input (jadi `VOID`, perlu alasan + role OWNER sesuai aturan void di atas; dalam praktiknya OWNER yang tutup shift jadi ini natural).
  - **Tandai Piutang** — order benar-benar belum dibayar pelanggan. Wajib isi nama (`customerName`). Status jadi `RECEIVABLE`, **tidak** dihitung sebagai penjualan cash/non-cash, dan muncul di halaman daftar piutang terpisah supaya bisa dilunasi belakangan.

## Dashboard — Tahap 11 Bagian B

`/dashboard`, **OWNER only** — dicek server-side di `page.tsx` sendiri (`redirect("/kasir")` kalau bukan OWNER), bukan cuma disembunyikan dari menu. Route export Excel (`/dashboard/export`) adalah entry point terpisah dari halaman, jadi punya `requireRole("OWNER")` sendiri di baris pertama — redirect di halaman tidak melindungi URL itu. Link "Dashboard" di nav Order Aktif juga cuma muncul untuk user `role === "OWNER"` (UX, bukan pengaman). Layar ini dipakai **duduk**, sengaja TIDAK dipadatkan seperti Kasir/Order Aktif (lihat "Kepadatan layar" di atas).

Urutan section (atas ke bawah = prioritas keseringan dibuka, sesuai diskusi pemilik):
1. **Riwayat Shift & Selisih Kas** — paling atas. Tabel per shift + grafik tren `difference` (bukan alarm ambang "konsisten minus" buatan sendiri — pemilik lebih tahu polanya sendiri daripada angka ambang yang saya karang).
2. **Omzet** — grafik dengan toggle Harian/Mingguan/Bulanan, di-bucket **client-side** dari histori shift mentah (`get-omzet-history.ts` + `bucket-omzet.ts`) supaya ganti rentang instan tanpa round-trip.
3. **Menu & Topping Terlaris** — dua ranking independen (produk base vs opsi add-on), beda dari shortcut kombo Tahap 10 (yang me-ranking kombinasi produk+addon sebagai satu unit).
4. **Margin** — dari snapshot `costPrice` di `OrderItem`/`OrderItemAddon`, bukan dari harga Product/AddonOption yang hidup sekarang. `costPrice` defaultnya kosong per produk sampai diisi manual owner — badge "HPP belum diisi" per produk + banner peringatan kalau ada satu saja produk di laporan yang HPP-nya kosong, supaya angka margin yang sebenarnya "belum ada datanya" tidak terbaca sebagai "untungnya emang tipis".
5. **Per Channel** — Dine In/Bungkus/Antar.
6. **Piutang Belum Lunas** — data & aksi sama persis dengan halaman `/piutang` yang sudah ada (baris di sini link ke `/pembayaran/[id]` juga) — satu sumber kebenaran, bukan logika duplikat.

Aturan angka:
- Section 1 & 2 (apa pun yang berbasis "penjualan shift") **selalu dibaca dari nilai beku di baris `Shift`** (`cashSales`, `nonCashSales`, dst — lihat "Shift & kas" di atas), **tidak pernah** dihitung ulang dari `Order`. Section 3-6 justru HARUS baca dari `OrderItem`/`Order` langsung (item terlaris, margin per produk, breakdown channel — Shift tidak menyimpan rincian itu), tapi tetap cuma `status: "PAID"` yang dihitung; `VOID`/`RECEIVABLE` tidak pernah masuk hitungan mana pun.
- Section 3-5 pakai jendela rolling 30 hari yang sama (`DASHBOARD_WINDOW_DAYS`, `src/lib/dashboard/config.ts`) — tidak ada date-range picker terpisah per section, biar layarnya tetap sederhana. Section 2 rentangnya independen (toggle Harian/Mingguan/Bulanan-nya sendiri).
- Total "omzet" di section Margin (murni `lineTotal` item, tanpa ongkir) dan total "omzet" di section Per Channel (termasuk ongkir Antar) **sengaja beda angka** — bukan bug, dua hal yang diukur memang berbeda (omzet produk vs total nilai transaksi).

**Export Excel** (`buildReportWorkbook`, pakai `exceljs`) — satu file tiga sheet, **tidak dibatasi rentang tanggal** (dump semua data, beda dari section 3-5 yang 30 hari): `Transaksi` (satu baris per order `PAID`), `Rekap Harian` (rollup harian dari baris Shift beku yang sama seperti section 1/2, bukan dari Order), `Riwayat Shift` (satu baris per shift tertutup). Semua kolom uang adalah **numeric cell** (`style: { numFmt: "#,##0" }`), bukan string, supaya bisa langsung dijumlah di Excel. Tanggal/jam di export pakai getter lokal Date (`getFullYear`/`getHours`/dst), BUKAN `toISOString().slice(...)` — server jalan di Asia/Jakarta, dan `toISOString` selalu UTC, jadi slicing langsung dari situ akan geser jam tampil (jam buka 08:00 WIB pernah salah tercatat sebagai "01:00" sebelum ini diperbaiki).

Grafik (`TrendLineChart`, `BarChart` di `src/components/dashboard/`) SVG buatan sendiri, tanpa library chart — `viewBox` lebar mengikuti jumlah titik data tapi tinggi tetap lewat CSS (`preserveAspectRatio="none"`), supaya tidak pernah gepeng di layar sempit (HP, lihat "Tes dua ukuran layar" — dashboard/laporan/piutang wajib kebaca di 390×844, beda dari Kasir/Order Aktif yang wajib padat di 1280×800 tablet).

## Auth

- Login pakai **username + password**, tidak ada konsep email yang terlihat user. Di balik layar dipetakan ke email sintetis (`username@warung.local`) untuk Supabase Auth. Verifikasi email harus OFF di project Supabase (domain sintetis tidak bisa terima email).
- Rencana masa depan (belum dibangun): layar kasir auto-login permanen (device-level session, tidak pernah lihat halaman login); dashboard OWNER dikunci password dengan session timeout idle yang balik ke layar kasir; identitas kasir individual dipakai lewat PIN 4 digit saat buka shift, bukan username/password.

## Lain-lain

- Produk & add-on option pakai soft delete (`isActive`), tidak pernah hard delete — laporan lama tetap mereferensikan.
- **Menu populer (shortcut kombinasi) — dibangun Tahap 10.** Agregasi rolling 30 hari dari `Order.paidAt` (bukan `createdAt`), ambang minimal 10x qty terjual dalam periode, cache (`ComboCache`) di-refresh sekali sehari saat tutup shift — bukan real-time — lewat `refreshComboCache()` (`src/lib/combo/refresh-combo-cache.ts`), dipanggil dari `closeShift`, gagal-diam (`try/catch` + `console.error`) supaya kegagalan agregasi tidak pernah memblokir penutupan shift beneran.
  - **Kombinasi TANPA add-on sama sekali tidak pernah masuk shortcut** — produk polos sudah satu tap di grid produk, jadi shortcut untuknya tidak menghemat langkah apa pun, cuma makan slot. Dideteksi lewat `OrderItem.addons.length === 0`.
  - Sebelum ada combo asli yang lolos ambang (termasuk hari pertama install), shortcut menampilkan 6 kombinasi manual (`NAMED_COMBOS` di `src/lib/combo/named-combos.ts`) — diseed sekali oleh `prisma/seed.ts` (`seedComboCache`, skip kalau `ComboCache` sudah berisi apa pun, supaya reseed tidak pernah mengotori data asli yang sudah mengambil alih). Harga tiap combo seed **dihitung** dari harga produk+addon aktif saat seeding (memakai map yang sama dengan `verifySeedPrices`), tidak pernah di-hardcode — supaya otomatis benar tiap kali harga menu berubah.
  - **Begitu ada combo asli yang lolos ambang, cache diganti SELURUHNYA oleh data asli, bukan digabung** dengan 6 combo manual — cocok literal sama kalimat keputusan awal ("dipakai sebelum data asli terkumpul"). Kalau cuma sebagian combo asli yang lolos (bukan pas 6), yang tampil ya sejumlah itu, bukan dipaksa genap 6.
  - **Label yang ditampilkan pakai bahasa warung** ("Mie Ayam Komplit"), bukan gabungan mentah nama produk+addon. Combo asli yang `comboKey`-nya kebetulan cocok dengan salah satu `NAMED_COMBOS` otomatis ikut memakai nama kurasi itu; combo asli lain yang belum pernah dikurasi manual jatuh ke label fallback (nama produk + nama addon dipisah spasi, TANPA tanda "+") sampai suatu saat ada halaman admin untuk menamainya (belum dibangun).
  - Harga yang tampil di kartu shortcut dan yang benar-benar masuk keranjang saat di-tap **selalu dihitung ulang dari menu aktif saat itu** (`resolveComboShortcut` mencocokkan `productId`/`addonOptionId` di cache ke `MenuCategory[]` yang sedang dipakai layar, bukan memakai angka `totalPrice` yang di-cache) — jadi staleness cache (maksimal 1 hari) tidak pernah bikin harga di keranjang beda dari yang tercetak di struk nanti; `buildOrderItemsCreateData` tetap re-fetch harga dari DB lagi saat order disimpan, sama seperti jalur tap-produk-biasa. Kalau produk/addon yang direferensikan sebuah shortcut sudah di-nonaktifkan sejak cache terakhir refresh, shortcut itu otomatis hilang dari layar (bukan error) sampai refresh berikutnya membersihkannya dari cache.
  - Muncul di Kasir maupun layar pre-order baru (keduanya berbagi komponen `ComboShortcutRow`), supaya konsisten — cashier yang sudah biasa pakai shortcut di Kasir tidak kaget lihat itu hilang saat bikin pre-order.
- Animasi dibatasi ketat: cuma bottom sheet add-on (slide dari bawah) dan feedback singkat saat item masuk keranjang. Ganti kategori, tap produk, dan navigasi antar halaman harus **instan tanpa transisi** — target device tablet Android entry-level, responsivitas di atas kehalusan.

## Yang belum diputuskan (tidak ada — semua item sudah dijawab per catatan di atas)

## Server-side authorization

Setiap aksi khusus role OWNER **wajib** memanggil `requireRole("OWNER")` (dari `src/lib/auth/get-current-user.ts`) sebagai baris pertama di server action-nya sendiri — bukan cuma menyembunyikan tombol di UI. Menyembunyikan tombol itu UX, bukan keamanan; siapa pun bisa memicu server action lewat devtools tanpa lewat tombol sama sekali.

Sudah diverifikasi (bukan cuma dibaca kodenya): request asli ditangkap dari sesi OWNER yang klik "Batalkan", lalu direplay langsung ke server dari sesi CASHIER sungguhan (login beneran, request sungguhan, order id berbeda) — server menolak dengan HTTP 500 `"Forbidden: requires role OWNER"`, dan data di database tidak pernah berubah. Pola ini (`requireRole` di baris pertama action) wajib dipakai persis sama untuk setiap fitur OWNER-only berikutnya (dashboard, ubah harga, manajemen menu, manajemen user) begitu dibangun — dan diverifikasi dengan cara yang sama (capture request asli dari sesi berwenang, replay dari sesi tidak berwenang, cek server menolak DAN data tidak berubah), bukan cuma dicek lewat UI.

## Design System

Semua layar wajib pakai token dan komponen terpusat ini — tidak ada lagi warna/radius/spacing pilihan sendiri per halaman.

**Token** (`src/app/globals.css`, via `@theme`): warna (`bg-canvas`, `bg-surface`, `text-ink` / `text-ink-muted` / `text-ink-faint`, `bg-primary` / `bg-primary-soft`, `bg-muted`, `bg-danger` / `bg-warning` / `bg-info` + varian `-soft`), radius (`rounded-pill`, `rounded-card`, `rounded-sheet`, `rounded-input`), shadow (`shadow-card`, `shadow-sheet`). Warna hijau (`--color-primary`) didekati dari referensi GoFood — bukan pixel-perfect (sumbernya foto WhatsApp), tapi searah.

**Tidak ada dark mode otomatis.** Ini kios di tablet tetap, bukan situs konsumen — tablet yang tiba-tiba ganti ke palet gelap yang belum pernah diuji di tengah shift lebih buruk daripada tidak pernah mendukung dark mode sama sekali.

**Komponen bersama** (`src/components/ui/`): `Button` (primary/secondary/ghost/danger — client, pakai `motion` untuk scale saat ditekan), `LinkButton` (tampilan identik `Button` tapi untuk navigasi `<Link>`, server-renderable, TIDAK boleh impor apa pun dari `button.tsx` karena itu file `"use client"` — style bersama ada di `button-styles.ts` yang netral), `Card` (permukaan putih di atas `bg-canvas`), `ListRow` (baris list dengan padding konsisten; pakai `onClick` untuk aksi in-page atau `asLink` untuk navigasi), `Sheet` (shell bottom sheet dengan drag handle), `Badge`, `PriceText` (lihat aturan hierarki di bawah).

**Aturan hierarki harga** (perbaikan dari `PriceText` weight prop) — dulu nama item dan harga sama-sama bold, sekarang:
- `weight="primary"`: harga produk sendiri di halaman custom/detail (subjek utama baris itu).
- `weight="secondary"`: harga di baris keranjang/order-item (nama item yang bold/subjek, harga jadi angka pendukung di sebelahnya), dan harga opsi add-on.
- `weight="total"`: SATU angka yang paling penting di layar itu (Total, Subtotal-sebagai-penutup-list, Selisih kas) — lebih besar, bold, dipisah garis pembatas dari baris-baris di atasnya. Subtotal/Total tidak boleh terlihat seperti baris item biasa.

**Satu aksi utama per layar/kartu.** Kalau ada dua tombol berdampingan, cuma satu yang `variant="primary"` (hijau solid, dominan) — sisanya `secondary`/`ghost`. Jangan biarkan dua tombol sama menonjolnya berebut perhatian.

**Animasi** (pakai `motion`, transform+opacity saja — tidak ada yang memicu layout reflow, supaya ringan di tablet Android entry-level):
- Bottom sheet: slide dari bawah + fade backdrop, 200-220ms, `easeOut`.
- Tekan tombol: scale ke 0.97-0.99, ~120ms (built-in di `Button`/`ListRow`/`ProductButton`).
- Item baru masuk keranjang: fade+scale singkat (~200ms), item lain di keranjang tidak ikut animasi.
- **Instan, tanpa animasi apa pun:** ganti kategori, tap tombol produk (aksinya, bukan feedback tekan), navigasi antar halaman.

**Jebakan client/server yang sudah dua kali kejadian** — kalau bikin komponen UI baru yang punya varian client (butuh interaktivitas/motion) dan varian server-renderable (misal cuma `<Link>`), taruh logic/class yang dipakai bersama di file netral TANPA `"use client"`, jangan saling impor fungsi antar file client dan server. Lihat `button-styles.ts` sebagai contoh polanya.
