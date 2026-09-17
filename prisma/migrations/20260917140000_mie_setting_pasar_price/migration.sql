-- CreateTable
CREATE TABLE "MieSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "pasarPricePerKg" INTEGER,

    CONSTRAINT "MieSetting_pkey" PRIMARY KEY ("id")
);

-- The "Mie Pasar" price used to be a code constant (14.000, the value the
-- owner specified); carry it over as the starting value so the shortcut
-- keeps working unchanged until the owner edits it from /note/produk.
INSERT INTO "MieSetting" ("id", "pasarPricePerKg") VALUES ('singleton', 14000);
