-- "Belum Bayar" + piutang settlement attributed to the shift open when it is
-- paid (25 Sep 2026). Purely additive: nullable columns, no data touched.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "settledShiftId" TEXT,
ADD COLUMN "settlementCashToDrawer" BOOLEAN;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN "receivableSettledCash" INTEGER,
ADD COLUMN "receivableSettledNonCash" INTEGER,
ADD COLUMN "receivablePocketCash" INTEGER;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_settledShiftId_fkey" FOREIGN KEY ("settledShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
