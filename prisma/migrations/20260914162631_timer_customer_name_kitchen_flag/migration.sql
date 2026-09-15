-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerName" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "isKitchenItem" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "prepBaseMinutes" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "prepMinutesPerPortion" INTEGER NOT NULL DEFAULT 1;
