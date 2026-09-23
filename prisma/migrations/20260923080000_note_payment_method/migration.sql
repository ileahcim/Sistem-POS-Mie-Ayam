-- Metode bayar (Cash/QRIS) untuk baris PAYMENT di buku Note — Mi Mentah dan
-- Frozen sama-sama memakai enum ini: satu konsep yang sama, bukan dua enum
-- kembar. Sengaja BUKAN enum "PaymentMethod" milik POS: yang itu juga punya
-- TRANSFER dan SPLIT, yang tidak berlaku di sini, dan memakainya akan
-- menyiratkan uang Note ikut rekonsiliasi laci warung — padahal tidak
-- (CLAUDE.md "Catatan Mi Mentah": dunia terpisah dari POS).
--
-- Aditif dan NULLABLE: tidak ada satu baris pun yang diubah oleh migrasi
-- ini. Baris pembayaran lama tetap NULL dan ditampilkan sebagai "Tidak
-- dicatat" di mana pun kolom ini muncul — menebaknya jadi Cash atau QRIS
-- berarti mengarang data yang memang tidak pernah tercatat.
CREATE TYPE "NotePaymentMethod" AS ENUM ('CASH', 'QRIS');

ALTER TABLE "MieLedgerEntry" ADD COLUMN "paymentMethod" "NotePaymentMethod";
ALTER TABLE "FrozenLedgerEntry" ADD COLUMN "paymentMethod" "NotePaymentMethod";
