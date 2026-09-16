-- DropIndex
DROP INDEX "Order_shiftId_queueNumber_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "queueSuffix" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Order_shiftId_queueNumber_queueSuffix_key" ON "Order"("shiftId", "queueNumber", "queueSuffix");

