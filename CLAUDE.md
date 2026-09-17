@AGENTS.md

# POS Mi Ayam — Keputusan Produk

Ini catatan keputusan yang **sudah final** hasil diskusi dengan pemilik warung. Jangan diubah tanpa konfirmasi ulang. Kalau ada yang terlihat keliru secara teknis dari keputusan ini, bilang dulu sebelum ngoding.

## Bahasa

**Semua balasan dan rangkuman Claude Code di proyek ini wajib pakai Bahasa Indonesia** (permintaan eksplisit pemilik warung, Tahap 12). Kode, nama variabel/fungsi, dan komentar teknis tetap Inggris seperti biasa — ini soal bahasa komunikasi ke pemilik, bukan bahasa kode.

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

## Rendering dinamis — JANGAN dihapus dari root layout

`src/app/layout.tsx` punya `export const dynamic = "force-dynamic"`. **Ini bukan boilerplate, jangan pernah dihapus atau di-override `"auto"`/`"force-static"` di layout/page mana pun** — ditemukan waktu persiapan deploy Tahap 12 lewat `next build` + `next start` beneran (bukan cuma `next dev`), bukan dari membaca dokumentasi saja.

**Masalahnya:** halaman yang HANYA memanggil Prisma (tanpa `cookies()`/`headers()` sendiri — misalnya `kasir/page.tsx` yang cuma manggil `getOpenShift()`/`getActiveMenu()`, autentikasinya sendiri ditangani `src/proxy.ts`, bukan di page-nya) tidak memberi sinyal apa pun ke static-analysis Next.js bahwa halaman itu perlu dirender ulang tiap request — Prisma bukan `fetch()`, jadi tidak kelihatan oleh heuristik caching Next.js. Akibatnya beberapa halaman (Kasir, Piutang, Pesanan Terjadwal, Buka Shift, Input Pengeluaran) otomatis ditandai statis oleh `next build` ("○ Static") dan di-render SEKALI lalu HTML-nya dibekukan selamanya — dibuktikan langsung: harga produk diubah paksa lewat DB saat `next start` jalan, reload keras di browser tetap menampilkan harga lama, sampai `dynamic = "force-dynamic"` ditambahkan di root layout (yang otomatis berlaku ke semua route di bawahnya) dan build ulang — baru setelah itu semua 21 halaman aplikasi tertandai "ƒ Dynamic" dan harga baru langsung muncul di request berikutnya.

Tidak ada halaman yang benar-benar statis di aplikasi ini (semua butuh data live atau sesi live), jadi memaksa dinamis di root layout adalah default yang benar untuk SELURUH pohon route, bukan sesuatu yang perlu di-opt-in per halaman baru. Kalau suatu saat ada halaman yang benar-benar ingin di-cache (jarang, dan harus didiskusikan dulu), override `dynamic` di halaman ITU secara eksplisit — jangan mengubah default root layout.

## Konteks pengguna (penting untuk semua keputusan UI)

Yang menjaga warung adalah **karyawan berusia lanjut yang kurang terbiasa teknologi**. Implikasinya untuk setiap layar kasir:
- Langkah sesedikit mungkin, tombol sebesar mungkin (min. 48px).
- Hindari input teks/keyboard numerik sebagai jalur utama.
- Hindari wizard multi-langkah kecuali benar-benar perlu.

Buka/tutup shift dikerjakan **pemilik**, bukan karyawan — jadi layar shift boleh sedikit lebih kompleks daripada layar kasir harian.

**Kepadatan layar — Tahap 11.** Kasir dan Order Aktif (termasuk detail order & tambah item) dipakai sambil **berdiri melayani antrian** — dipadatkan supaya di tablet 10" landscape (1280×800) grid produk, keranjang, dan tombol aksi kelihatan sekaligus tanpa scroll untuk order ukuran normal (order yang sangat besar, >10 baris berbeda, tetap boleh scroll internal di panel keranjang — itu wajar, bukan yang disasar). Ukuran sentuh tombol **tidak pernah dikecilkan** (tetap ≥48px) — yang dipangkas cuma padding/gap/tinggi baris di sekitarnya. `ListRow` (`src/components/ui/list-row.tsx`) punya prop `dense` khusus untuk ini — dipakai HANYA di Order Aktif (`order-row.tsx`, unpaid-served list di `order-aktif-list.tsx`). Jangan pakai `dense` di layar lain (Piutang, Pesanan Terjadwal, Dashboard, laporan, Tutup Shift) — layar-layar itu dipakai duduk dan sengaja tetap lega.

## Menu & harga

- Menu = produk base + add-on (bukan produk terpisah per kombinasi).
- **Bakso Urat Ceker harga yang benar adalah 18.000** (Bakso 13.000 + Jenis Bakso "Upgrade ke Urat" +3.000 + Topping "Ceker" +2.000). Menu cetak fisik salah ketik jadi 19.000 — sistem kita menghitung dari base+addon jadi otomatis benar (18.000), tidak perlu koreksi kode apa pun untuk ini.
- **Grup "Jenis Bakso" opsional** (min 0, maks 1): isinya cuma "Upgrade ke Urat" (+3.000) dan "Upgrade ke Telur" (+5.000). Tidak memilih apa pun = Bakso biasa Rp13.000 — sengaja **tidak ada** opsi "Biasa", supaya pesanan bakso polos (yang paling sering) tidak butuh tap ekstra. Opsi "Biasa" lama di-soft-delete (`isActive=false`) oleh migrasi `20260917100200_bakso_jenis_optional`, yang juga mengganti nama "Urat"/"Telur" **di tempat** (id tetap, jadi `comboKey`, `ComboCache`, dan snapshot order lama tetap cocok). Saat migrasi dibuat, belum ada satu pun order yang memakai "Biasa", jadi tidak ada data historis yang perlu dipindah. Di layar add-on, opsi pilih-satu yang opsional bisa di-tap lagi untuk batal memilih.
- Halaman HPP: item dengan harga jual Rp0 menampilkan "Harga dasar, tidak ada markup", bukan angka untung/persentase yang membingungkan.
- Urutan kategori di layar kasir: Makanan, Minuman Racik, Kulkas, Lain-lain, Frozen (paling bawah).
- Channel: Dine In, Bungkus, Antar — **tidak ada** GoFood/GrabFood/ShopeeFood. Pesanan dari aplikasi ojol tidak pernah diinput ke POS ini sama sekali.
- Meja: K1, K2 (kursi), L1, L2, L3 (lesehan) — label persis ini, bukan nomor 1-5.

## Order & status

- Semua order defaultnya **belum dibayar**. Bayar di muka adalah pengecualian, bukan alur utama.
- `servedAt` (makanan keluar) dan `paidAt` (sudah bayar) adalah dua hal independen — order bisa disajikan duluan lalu dibayar belakangan, atau sebaliknya.
- Nomor antrian: otomatis, reset per shift, digenerate **server-side** (atomic increment di baris Shift) supaya dua device tidak bentrok.
- Nama tamu: **opsional**, field bebas (`Order.customerName`) — bisa diisi nama orang atau catatan lain yang berguna buat kasir, tidak wajib diisi.
- Order berstatus `PAID` beku, tidak bisa diedit. Kalau pelanggan nambah setelah bayar, itu **order baru**, bukan tambahan ke order lama.
- **Void = khusus order yang SUDAH dibayar (`PAID`)**, hanya role **OWNER**, wajib alasan — karena menyangkut uang yang sudah masuk laci/QRIS. Tombol "Void Order" ada di halaman detail order dan Riwayat Pesanan, hanya tampil untuk OWNER dan hanya untuk order `PAID`; action `voidPaidOrder` (`src/app/riwayat-pesanan/actions.ts`) memanggil `requireRole("OWNER")` di baris pertama (sudah diverifikasi dengan replay dari sesi CASHIER — ditolak, data tidak berubah). Order yang di-void tidak dihitung sebagai penjualan cash saat rekonsiliasi shift (`closeShift` cuma menjumlah `PAID`), jadi kalau shift-nya masih terbuka, uangnya harus dikembalikan dari laci. Kalau shift order itu **sudah ditutup**, laporan shift itu tetap beku (lihat "Shift & kas") — sheet Void menampilkan peringatan itu.
- **"Batalkan Order" (status `CANCELLED`, label "Batal") — terpisah dari Void.** Khusus order `OPEN` (belum dibayar): salah input, pelanggan tidak jadi, order dobel. **Boleh CASHIER** (belum ada uang yang tersentuh), tetap wajib alasan (ada tombol alasan cepat + isian bebas). Kolomnya sendiri (`cancelReason`/`cancelledById`/`cancelledAt`), tidak memakai kolom `void*`. Tombolnya ada di baris Order Aktif (tombol "Batal"), di halaman detail order, dan di alur Tutup Shift — ketiganya komponen dan action yang sama (`CancelOrderButton` → `cancelOrder`), bukan jalur terpisah. Order yang dibatalkan hilang dari Order Aktif, tetap tercatat di Riwayat Pesanan dengan status Batal + alasan + siapa yang membatalkan, dan tidak pernah dihitung sebagai penjualan (semua hitungan cuma membaca `PAID`). Action: `cancelOrder` di `src/app/order-aktif/actions.ts` — status dicek di dalam `WHERE` update supaya tidak bisa menimpa order yang barusan dibayar.
- **Bungkus & Antar selesai begitu dibayar.** `payOrder` otomatis mengisi `servedAt` (= `paidAt`) untuk channel Bungkus/Antar, jadi order langsung hilang dari Order Aktif tanpa tap "Sudah Disajikan"; tombol itu juga tidak ditampilkan untuk Bungkus/Antar yang belum dibayar. **Dine In tidak berubah** — tetap dua langkah (bayar dan disajikan independen), karena di Dine In makanan biasanya keluar duluan.
- Harga, nama produk, dan HPP di-snapshot ke `OrderItem` saat transaksi — laporan lama tidak pernah dihitung ulang dari tabel Product.
- `costPrice` diisi manual oleh owner (estimasi). Tidak ada sistem stok/BOM — di luar scope.

## Split payment ("Pisahkan & Bayar") — sudah dibangun

Kasus rombongan yang duduk di satu meja tapi mau bayar terpisah:
- **Tidak** ada fitur gabung order / pindah meja.
- Ada tombol **"Pisahkan & Bayar"** di halaman order: kasir centang sebagian item → sistem memindahkan item tercentang ke **order baru** dengan nomor antrian = nomor asli + suffix huruf (contoh: order #18 dipisah jadi `18-A`) → order baru itu langsung masuk alur pembayaran.
- Order induk tetap terbuka dengan sisa item yang tidak dipindah.
- Aturan keras: **satu order = satu pembayaran = satu struk**. Jangan pernah membuat order yang bisa dibayar berkali-kali.
- Ini kasus jarang — jangan sampai menambah langkah di alur pembayaran normal (single order, bayar sekali) untuk mengakomodasi ini.
- **Tampilan: dua panel berdampingan** (di layar sempit bertumpuk, panel kanan di bawah): kiri "Tetap di order ini", kanan "Dipisah & dibayar sekarang" (kosong di awal: "Belum ada item dipilih"), masing-masing dengan subtotal sendiri. Tap kartu di kiri = pindahkan 1 porsi ke kanan, tap kartu di kanan = kembalikan 1 porsi; kartu hilang dari panel begitu qty-nya 0. **Tanpa teks instruksi** — bentuk dua panel sudah cukup jelas. Animasi perpindahan cuma transform+opacity, singkat. Tombol "Pisahkan & Lanjut Bayar" aktif kalau panel kanan terisi (dan panel kiri masih menyisakan minimal 1 item — server menolak memindah semuanya; untuk itu pakai alur bayar biasa). Ini menggantikan versi lama (satu daftar dengan stepper − 0 +) yang terlalu ribet dipakai cepat.

## Ongkir (channel Antar)

- Rp1.000 per porsi kategori **Makanan saja** (bukan Minuman Racik/Kulkas/Lain-lain/Frozen), dihitung per qty bukan per baris.
- Baris terpisah di struk setelah subtotal.
- Tidak ada minimum ongkir — penolakan order kecil diputuskan manual oleh owner, bukan sistem.

## Struk & printer

- Print **hanya sekali**, saat pembayaran (MockPrinter sekarang, printer fisik menyusul).
- Item dengan nama + add-on identik digabung jadi satu baris dengan qty.
- Khusus channel Antar: tombol **"Print Daftar"** terpisah, dipakai **sebelum** bayar — kotak centang kosong di kiri tiap nama menu, qty dicetak besar, **tanpa harga/total** (ini daftar packing, bukan bukti bayar). Dibangun Tahap 8.
- Nama warung, alamat, telepon, footer struk **selalu** dari tabel `Setting` (singleton), tidak pernah di-hardcode di kode.
- **Printer fisik (Blueprint ECO80D) — urutan tes saat unit datang.** Seller mengonfirmasi printer ini mendukung **BT 2.0 (Classic/SPP) dan BT 5.0 (BLE)**. Coba implementasi **Web Bluetooth dulu** (`src/lib/printing/printers/web-bluetooth-printer.ts` — lewat BLE, lebih simpel, tanpa app perantara). Kalau gagal connect atau tidak stabil, baru pindah ke **RawBT** (`rawbt-printer.ts`, lewat Classic/SPP dengan app RawBT di tablet) yang sudah disiapkan sebagai cadangan. Dua-duanya masih stub sampai unit fisik ada.

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
  - **Batalkan** — untuk order salah input / tidak jadi. Sama persis dengan "Batalkan Order" di atas: status `CANCELLED`, boleh CASHIER, wajib alasan. (Dulu ini `VOID` khusus OWNER — diganti karena order belum dibayar tidak menyentuh uang; Void sekarang khusus order `PAID`.)
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

**Export Excel** (`buildReportWorkbook`, pakai `exceljs`) — satu file tiga sheet, **tidak dibatasi rentang tanggal** (dump semua data, beda dari section 3-5 yang 30 hari): `Transaksi` (satu baris per order `PAID`), `Rekap Harian` (rollup harian dari baris Shift beku yang sama seperti section 1/2, bukan dari Order), `Riwayat Shift` (satu baris per shift tertutup). Semua kolom uang adalah **numeric cell** (`style: { numFmt: "#,##0" }`), bukan string, supaya bisa langsung dijumlah di Excel. Tanggal/jam di export lewat `src/lib/timezone.ts` (`localDateStr`/`localTimeStr`) — lihat "Zona waktu" di atas untuk kenapa ini wajib, bukan sekadar `getFullYear`/`getHours` langsung.

Grafik (`TrendLineChart`, `BarChart` di `src/components/dashboard/`) SVG buatan sendiri, tanpa library chart — `viewBox` lebar mengikuti jumlah titik data tapi tinggi tetap lewat CSS (`preserveAspectRatio="none"`), supaya tidak pernah gepeng di layar sempit (HP, lihat "Tes dua ukuran layar" — dashboard/laporan/piutang wajib kebaca di 390×844, beda dari Kasir/Order Aktif yang wajib padat di 1280×800 tablet).

## PWA — Tahap 12

Bisa di-install ke home screen (Android tablet Kasir, dan juga berfungsi kalau owner install dari iPhone untuk Dashboard) lewat `src/app/manifest.ts` (Web App Manifest) + ikon yang di-generate dari satu sumber (`src/lib/pwa/app-icon-mark.tsx`, lewat `next/og`'s `ImageResponse` — bukan file gambar statis, jadi ganti warna brand otomatis ikut kalau tokennya berubah). `display: "standalone"` (tanpa address bar). **Sengaja TIDAK ada `orientation` lock di manifest** — instalasi yang sama dipakai landscape di tablet warung (Kasir/Order Aktif) dan portrait di HP owner (Dashboard), mengunci salah satu akan merusak yang lain.

Service worker (`public/sw.js`) **cuma cache shell aplikasi** — cache-first untuk build asset `/_next/static/*` (content-hashed, jadi cache tidak pernah basi), network-first untuk navigasi halaman dengan fallback ke `/offline` (halaman statis, HANYA saat benar-benar tidak ada koneksi). **JANGAN PERNAH** menambah antrian transaksi offline / background sync untuk menyimpan order saat offline — itu keputusan eksplisit, di luar scope Tahap 12 sepenuhnya.

Batasan penting yang sengaja dijaga:
- **Service worker tidak pernah cache atau menyajikan salinan basi dari halaman data-nya sendiri** (Order Aktif, Kasir, Dashboard) — cuma `/offline` yang di-precache, dan itu pun halaman statis tanpa data sama sekali. Alasan: nomor antrian atau kas yang basi lebih berbahaya daripada layar "tidak ada koneksi" yang jujur, untuk mesin kasir.
- `/offline` sengaja pakai **inline style, bukan class Tailwind/komponen `Card`/`Button` biasa** — `cache.addAll(["/offline"])` cuma nge-cache HTML halaman itu sendiri, bukan file CSS yang direferensikannya (nama filenya di-hash per build, tidak bisa ditebak dari `sw.js`). Kalau file CSS itu kebetulan belum pernah ke-cache lewat pola cache-first di atas, halaman offline yang pakai class Tailwind akan tampil sebagai teks polos tanpa gaya sama sekali — sudah dibuktikan (dan diperbaiki) secara langsung dengan mensimulasikan offline lewat Playwright.
- `src/proxy.ts` (auth gate) **wajib** mengecualikan `/manifest.webmanifest`, `/sw.js`, `/icon`, `/apple-icon`, dan turunannya (`/icon-192`, `/icon-512`) dari matcher-nya — browser mengambil aset-aset ini lepas dari status login (bahkan dari halaman `/login` itu sendiri), dan registrasi service worker **gagal total** kalau responsnya redirect (bukan 200 asli) atau Content-Type-nya salah. `/offline` juga harus selalu bisa diakses langsung tanpa pernah di-redirect balik ke `/` walau user sedang login — beda dari `/login` yang memang harus redirect kalau sudah login.

### Deploy Vercel

Project: `leahcim-team/pos-mi-ayam` (akun `ileahcim`, plan Hobby). Production: `https://pos-mi-ayam.vercel.app`. Environment variable production sudah dipasang (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — nilainya sama dengan `.env` dev sampai checklist go-live poin 1 (pisah database) dikerjakan. **Auto-deploy per push ke `main` sengaja dibiarkan menyala** (keputusan pemilik) — lihat poin 6 checklist go-live untuk kapan mempertimbangkan mematikannya.

Dua jebakan yang sudah kejadian nyata sekali saat setup awal, dicatat supaya tidak terulang kalau project di-deploy ulang dari nol:
- **Project yang dibuat lewat `vercel project add` (bukan lewat alur import dashboard) tidak otomatis punya Framework Preset ke Next.js** — build tetap "sukses" (log build tetap menjalankan `next build` dan menampilkan tabel Route yang benar), tapi diam-diam jatuh ke builder `@vercel/static-build` generik yang cuma menyalin folder `public/` sebagai file statis dan **tidak membuat satu serverless function pun** — hasilnya semua halaman (termasuk `/login`) 404 di production walau build "sukses" dan deployment status "Ready". Terbukti lewat `vercel build` lokal: `.vercel/output/` cuma berisi `static/`, tidak ada folder `functions/`, dan `builds.json` menyebut `"detectedFramework": {"status": "skipped"}` + `"require": "@vercel/static-build"`. Perbaikannya: `vercel project update <nama> --framework nextjs --yes` lalu deploy ulang — setelah itu tabel Route yang sama menghasilkan 21 function sungguhan.
- **Project baru di tim ini otomatis kena "Deployment Protection" (SSO Vercel)** untuk semua domain `*.vercel.app` termasuk production (`all_except_custom_domains`) — URL production tidak bisa diakses sama sekali tanpa login ke akun Vercel tim, jadi tablet kasir pasti gagal connect kalau ini tidak dimatikan. Dimatikan lewat `vercel project protection disable <nama> --sso` (butuh konfirmasi eksplisit dari pemilik karena ini melemahkan lapisan akses — keamanan aplikasi tetap dijaga oleh login username/password POS sendiri, bukan lapisan SSO Vercel ini).

**Sambungan GitHub untuk auto-deploy belum berhasil dibuat lewat CLI** (`vercel git connect` gagal dengan pesan generic "Failed to connect... Make sure you have access to the repository", walau repo publik dan bisa diakses) — kemungkinan besar karena Vercel GitHub App belum pernah diinstal/diotorisasi untuk akun `ileahcim` di GitHub, dan itu langkah consent yang cuma bisa diselesaikan lewat UI (browser), tidak lewat token API. Kalau perlu diulang: buka `https://vercel.com/leahcim-team/pos-mi-ayam/settings/git` dan klik "Connect Git Repository", ikuti alur otorisasi GitHub yang muncul.

## SEBELUM DIPAKAI DI WARUNG — checklist wajib go-live

Aplikasi sudah di-deploy (Tahap 12), tapi database yang dipakai sekarang masih database **dev** yang sama dari seluruh proses development — belum aman dipakai transaksi sungguhan di warung. Enam hal ini **wajib** selesai dulu sebelum kasir mulai pakai aplikasi ini untuk jualan beneran:

1. **Pisahkan database.** Buat project Supabase kedua khusus production. Database yang sekarang jadi dev — boleh dihapus-hapus isinya, dan Claude Code boleh terus memakainya untuk pengembangan/testing. Database production **tidak boleh disentuh Claude Code sama sekali**.
2. **Ganti password akun OWNER dan CASHIER** — saat ini masih `1234` untuk keduanya (nilai seed development).
3. **Isi `costPrice` semua produk dan add-on** — sekarang masih 0, jadi grafik margin di Dashboard belum berarti apa-apa (lihat banner peringatan "HPP belum diisi" di section Margin).
4. **Tes cetak ke printer thermal asli (Blueprint ECO80D).** Sampai saat ini struk masih lewat `MockPrinter` (overlay di layar) — belum pernah benar-benar menyentuh kertas.
5. **Siapkan backup otomatis harian.** Plan Supabase gratis tidak menyediakan backup otomatis.
6. **Pertimbangkan matikan auto-deploy** di project Vercel saat warung sudah mulai jalan sehari-hari, supaya push kode di jam sibuk tidak langsung mengganti aplikasi yang sedang dipakai kasir. (Lihat catatan auto-deploy di "PWA — Tahap 12" / bagian deploy di bawah — untuk sekarang, selama masih tahap setup dan belum dipakai warung, auto-deploy sengaja dibiarkan menyala atas keputusan pemilik.)

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

## Catatan Mi Mentah (modul Note) — `/note`, OWNER only

Buku utang penjualan mi mentah dari tempat produksi — **dunia terpisah dari POS**: uangnya tidak pernah menyentuh Shift/Order/Expense/omzet kasir, dan tidak terhubung ke Dashboard POS. **Tidak butuh shift terbuka** (sering dicatat pagi sebelum warung buka) — ada link "Note (Mi Mentah)" di layar Buka Shift khusus OWNER. Semua action di `src/app/note/actions.ts` memanggil `requireRole("OWNER")` di baris pertama (diverifikasi replay dari sesi CASHIER untuk edit pelanggan, nonaktif, dan edit transaksi — ditolak, data tidak berubah).

Aturan data:
- **Saldo selalu jumlah baris ledger** (`MieLedgerEntry`), tidak pernah kolom tersimpan. `amount` selalu positif; tandanya ditentukan `kind`: `ORDER`, `OPENING_BALANCE`, `CORRECTION_ADD` menambah utang; `PAYMENT`, `CORRECTION_SUBTRACT` mengurangi (`mieEntrySignedAmount` di `src/lib/mie/types.ts` — satu-satunya tempat tanda diputuskan).
- Pembayaran tidak dicocokkan ke pesanan tertentu.
- **Koreksi saldo / utang lama selalu baris baru**, tidak pernah mengubah baris lama (tombol "Koreksi Saldo" di detail pelanggan: Utang lama / Koreksi (+) / Koreksi (−); koreksi wajib keterangan).
- **Edit & hapus baris riwayat boleh** (kg, harga/kg, nominal, tanggal, catatan; hapus dengan konfirmasi). Saldo berjalan baris-baris sesudahnya ikut berubah otomatis — itu perilaku yang benar. Nominal pesanan selalu dihitung ulang kg × harga/kg di server.
- **Pelanggan: nonaktif, bukan hapus**, kalau sudah punya satu saja baris ledger. Nonaktif = hilang dari daftar utama dan dari pilihan form pesanan/pembayaran (server juga menolak transaksi baru), tapi halaman riwayatnya tetap bisa dibuka (section "Pelanggan nonaktif" di `/note`) dan bisa diaktifkan lagi. **Saldo pelanggan nonaktif TETAP ikut Total Piutang** (keputusan pemilik: menonaktifkan orang tidak boleh bisa membuat utang "hilang" dari laporan) — ringkasan menampilkan pecahannya ("RpX dari pelanggan nonaktif", "N nonaktif") supaya bedanya jelas tanpa menyembunyikan angka. Pelanggan menunggak dan utang tertua juga menghitung semua pelanggan. Export Excel juga ikut semua pelanggan (kolom Status). **Hapus permanen** hanya kalau pelanggan belum punya baris ledger sama sekali (dicek di dalam transaksi yang sama dengan delete).
- Daftar `/note`: pencarian nama/keterangan langsung saat mengetik, toggle urutan "Utang terbesar" (default) / "Nama A-Z" — semuanya client-side dari data yang sudah dimuat.
- **Input tap-dulu** (dicatat sambil berdiri di tempat produksi): kartu pelanggan di `/note` punya tombol "+ Pesanan"/"+ Bayar" langsung (form terbuka dengan pelanggan terisi; hanya pelanggan aktif). Form pesanan: shortcut **"Mie Pasar"** = Mi Keriting Rp14.000/kg (preset tetap, bukan autofill per pelanggan — harganya bertahan walau pelanggan diganti setelahnya) dan preset kg 5/10/15/20. Form pembayaran: preset 50rb/100rb/200rb/500rb dan **"Lunas penuh"** (mengisi sisa saldo pelanggan terpilih, ikut berubah kalau pelanggan diganti). Semua tetap bisa diketik manual. Nilai preset ada di `src/lib/mie/types.ts`.
- **Ringkasan** (`/note/ringkasan`): monitoring khusus modul ini, datanya sendiri (`get-mie-report.ts`), tidak pernah dicampur dengan Dashboard POS (cuma komponen gambar `BarChart` yang dipakai bersama). Toggle Harian (14 hari)/Mingguan (8)/Bulanan (6), periode kosong tetap tampil sebagai nol. Omzet = jumlah semua baris `ORDER` (bukan cuma yang belum lunas), pembayaran = jumlah `PAYMENT`; saldo awal dan koreksi tidak dihitung sebagai keduanya. Rincian per jenis mi (kg + nilai) untuk periode terpilih — ketuk baris periode untuk menggantinya. Semua pelanggan dihitung, termasuk nonaktif. Dikelompokkan per tanggal WIB (via `timezone.ts` di server, lalu matematika tanggal murni di `bucket-mie.ts`).
- Tanggal di form Note memakai jam dinding perangkat (`src/lib/mie/date-input.ts`), pengecualian yang sama dengan input tanggal pre-order (lihat "Zona waktu").

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
