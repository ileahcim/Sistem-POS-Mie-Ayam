-- Buku Frozen: Mie Frozen consigned to a reseller, settled separately from
-- both the POS cash drawer and mi mentah (CLAUDE.md-worthy brief, 22 Sep
-- 2026). New tables only — additive, nothing existing changes shape. The
-- FROZEN value already in MieProductType (added by last night's migration,
-- now retired) is NOT touched here — Postgres can't cleanly drop an enum
-- value, and the app stops writing it going forward regardless.

CREATE TYPE "FrozenLedgerKind" AS ENUM ('ORDER', 'PAYMENT', 'OPENING_BALANCE', 'CORRECTION_ADD', 'CORRECTION_SUBTRACT');

CREATE TABLE "FrozenCustomer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FrozenCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FrozenLedgerEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "FrozenLedgerKind" NOT NULL,
    "pcs" INTEGER,
    "pricePerPcs" INTEGER,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FrozenLedgerEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FrozenLedgerEntry" ADD CONSTRAINT "FrozenLedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FrozenCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FrozenLedgerEntry" ADD CONSTRAINT "FrozenLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "FrozenLedgerEntry_customerId_idx" ON "FrozenLedgerEntry"("customerId");

-- Frozen buku's default Rp/pcs — owner-approved starting value (22 Sep
-- 2026), editable afterwards from /note/produk like every other price here.
ALTER TABLE "MieSetting" ADD COLUMN "frozenPricePerPcs" INTEGER;
INSERT INTO "MieSetting" ("id", "frozenPricePerPcs") VALUES ('singleton', 9000)
  ON CONFLICT ("id") DO UPDATE SET "frozenPricePerPcs" = 9000;
