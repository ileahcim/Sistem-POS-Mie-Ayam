-- "Perkiraan Bakso Terpakai" (Dashboard, CLAUDE.md, 24 Sep 2026) — informal
-- estimate, editable from Manajemen Menu instead of hardcoded. Additive
-- only — new table, nothing existing changes shape. Seeded with the
-- owner-given starting numbers (24 Sep 2026), same as every other
-- owner-approved default in this app.

CREATE TABLE "BaksoUsageSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "baksoPolosKecil" INTEGER NOT NULL DEFAULT 7,
    "baksoUratKecil" INTEGER NOT NULL DEFAULT 4,
    "baksoUratUrat" INTEGER NOT NULL DEFAULT 1,
    "baksoTelurKecil" INTEGER NOT NULL DEFAULT 4,
    "baksoTelurTelur" INTEGER NOT NULL DEFAULT 1,
    "toppingBaksoKecil" INTEGER NOT NULL DEFAULT 3,
    "toppingBaksoUratUrat" INTEGER NOT NULL DEFAULT 1,
    "toppingBaksoTelurTelur" INTEGER NOT NULL DEFAULT 1,
    "baksoKecilProdukKecil" INTEGER NOT NULL DEFAULT 3,
    "baksoSetengahKecil" INTEGER NOT NULL DEFAULT 4,
    "baksoUratBijianUrat" INTEGER NOT NULL DEFAULT 1,
    "baksoTelurBijianTelur" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BaksoUsageSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "BaksoUsageSetting" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP);
