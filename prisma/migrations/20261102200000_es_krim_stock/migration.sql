-- Es Krim dengan stok per pcs (docs/spec-es-krim.md, 2 Nov 2026).
-- Additive only: new columns with defaults on Product (every existing product
-- gets tracksStock=false / stock=0 and behaves exactly as before), one new
-- enum + table, then the owner-approved initial data. No existing row is
-- changed or deleted.

-- CreateEnum
CREATE TYPE "StockMovementKind" AS ENUM ('RESTOCK', 'SALE', 'SALE_RETURN', 'CORRECTION', 'SELF_USE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "boxPrice" INTEGER,
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tracksStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unitsPerBox" INTEGER;

-- Safety net under the app's own conditional update (stock >= qty): the
-- database itself refuses a negative stock, whatever code path tries it.
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK ("stock" >= 0);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "StockMovementKind" NOT NULL,
    "qtyChange" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "boxes" INTEGER,
    "unitsPerBox" INTEGER,
    "boxPrice" INTEGER,
    "unitCost" INTEGER,
    "orderId" TEXT,
    "takenBy" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_kind_createdAt_idx" ON "StockMovement"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data awal (owner-approved brief, 2 Nov 2026): kategori "Es Krim" (tab
-- terakhir di Kasir, bukan item dapur, tanpa ongkir) + 7 produk Diamond dari
-- belanja 31 Okt 2026. costPrice = harga box ÷ isi (semua habis dibagi).
-- Stok awal dicatat sebagai satu baris "Barang Masuk" (RESTOCK, 1 box) per
-- produk, bertanggal 31 Okt 2026 12:00 WIB (= 05:00 UTC — Prisma menyimpan
-- DateTime sebagai UTC), atas nama akun OWNER aktif yang paling lama.
-- ---------------------------------------------------------------------------
WITH cat AS (
  INSERT INTO "Category" ("id", "name", "sortOrder", "isKitchenItem", "createdAt")
  VALUES (gen_random_uuid()::text, 'Es Krim', 5, false, now())
  RETURNING "id"
),
data ("name", "price", "unitsPerBox", "boxPrice", "stock", "sortOrder") AS (
  VALUES
    ('Fun Mix Neapolitan',      6000, 30, 115200, 30, 0),
    ('Reguler Cup Vanila Chip', 4500, 24,  86400, 24, 1),
    ('Reguler Cup Coklat',      4500, 24,  86400, 24, 2),
    ('Sombrero Coklat',         7000, 24, 134400, 24, 3),
    ('Choconut Vanilla',        5500, 30, 135000, 30, 4),
    ('Chocodip Coklat',         4000, 30,  96000, 30, 5),
    ('Lolly Stroberi',          2000, 30,  48000, 30, 6)
),
prod AS (
  INSERT INTO "Product" (
    "id", "categoryId", "name", "price", "costPrice", "costPriceEstimated", "marginIntentional",
    "sortOrder", "isActive", "tracksStock", "stock", "unitsPerBox", "boxPrice", "createdAt", "updatedAt"
  )
  SELECT gen_random_uuid()::text, cat."id", d."name", d."price", d."boxPrice" / d."unitsPerBox", false, false,
         d."sortOrder", true, true, d."stock", d."unitsPerBox", d."boxPrice", now(), now()
  FROM data d CROSS JOIN cat
  RETURNING "id", "stock", "unitsPerBox", "boxPrice", "costPrice"
)
INSERT INTO "StockMovement" (
  "id", "productId", "kind", "qtyChange", "stockAfter", "boxes", "unitsPerBox", "boxPrice", "unitCost",
  "note", "createdById", "createdAt"
)
SELECT gen_random_uuid()::text, p."id", 'RESTOCK', p."stock", p."stock", p."stock" / p."unitsPerBox",
       p."unitsPerBox", p."boxPrice", p."costPrice", 'Stok awal (belanja 31 Okt 2026)',
       (SELECT u."id" FROM "User" u WHERE u."role" = 'OWNER' AND u."isActive" ORDER BY u."createdAt" LIMIT 1),
       TIMESTAMP '2026-10-31 05:00:00'
FROM prod p;
