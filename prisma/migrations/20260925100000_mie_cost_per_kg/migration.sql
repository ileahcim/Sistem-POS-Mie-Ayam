-- Modal per kg for the Mi Mentah buku (Ringkasan margin), 25 Sep 2026.
-- Purely additive columns; the only data touched is below, both approved by
-- the owner in the same conversation.

-- AlterTable
ALTER TABLE "MieProductDefault" ADD COLUMN "costPerKg" INTEGER;

-- AlterTable
ALTER TABLE "MieSetting" ADD COLUMN "pasarCostPerKg" INTEGER;

-- AlterTable
ALTER TABLE "MieLedgerEntry" ADD COLUMN "isPasar" BOOLEAN NOT NULL DEFAULT false;

-- Owner's estimate: Rp300.000 per bal (upper bound of 250-300rb, incl.
-- listrik + telur) / 30 kg. Mi Keriting Pasar, Mi Lurus and Pangsit stay
-- NULL ("belum diisi") until the owner fills them in.
INSERT INTO "MieProductDefault" ("productType", "costPerKg") VALUES ('MIE_KERITING', 10000)
ON CONFLICT ("productType") DO UPDATE SET "costPerKg" = EXCLUDED."costPerKg";

-- The three orders recorded before "Mi Pasar" was stored on the row: the
-- Rp14.000/kg orders of customer "Pasar" (22, 23, 24 Sep 2026; 158 kg), by
-- exact id from the list the owner checked. Every other row stays Reguler
-- (the column default). Ids that don't exist (e.g. a scratch schema) simply
-- match nothing.
UPDATE "MieLedgerEntry" SET "isPasar" = true
WHERE "kind" = 'ORDER'
  AND "productType" = 'MIE_KERITING'
  AND "id" IN ('cmudjz0ld000004l55r4ji72n', 'cmuezk5vw000004l8gzr8d9br', 'cmugh7dii000h04l2nuha01m8');
