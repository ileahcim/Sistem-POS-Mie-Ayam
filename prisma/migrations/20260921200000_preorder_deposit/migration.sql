-- Pre-order DP (uang muka).
--
-- Purely additive: one enum, six NULLABLE columns on "Shift" (no default, so
-- every shift that already closed keeps NULL there and its frozen report is
-- never recomputed), and one new table. No existing row is read or changed,
-- and the app version that is live right now keeps working against this schema
-- because it never mentions any of these columns.
-- CreateEnum
CREATE TYPE "DepositKind" AS ENUM ('RECEIVED', 'APPLIED', 'REFUNDED', 'FORFEITED');

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "depositRefundsCash" INTEGER,
ADD COLUMN     "depositRefundsNonCash" INTEGER,
ADD COLUMN     "depositsAppliedCash" INTEGER,
ADD COLUMN     "depositsReceivedCash" INTEGER,
ADD COLUMN     "depositsReceivedNonCash" INTEGER,
ADD COLUMN     "forfeitedDeposits" INTEGER;

-- CreateTable
CREATE TABLE "PreorderDeposit" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "DepositKind" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "shiftId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreorderDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreorderDeposit_orderId_idx" ON "PreorderDeposit"("orderId");

-- CreateIndex
CREATE INDEX "PreorderDeposit_shiftId_idx" ON "PreorderDeposit"("shiftId");

-- AddForeignKey
ALTER TABLE "PreorderDeposit" ADD CONSTRAINT "PreorderDeposit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreorderDeposit" ADD CONSTRAINT "PreorderDeposit_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreorderDeposit" ADD CONSTRAINT "PreorderDeposit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

