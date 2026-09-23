-- Ubah Metode Bayar (CLAUDE.md, 24 Sep 2026): correcting a mis-tapped
-- payment method on an already-PAID order without voiding it. Additive
-- only — new table, nothing existing changes shape.

CREATE TABLE "PaymentMethodChange" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromMethod" "PaymentMethod" NOT NULL,
    "fromCashAmount" INTEGER,
    "fromQrisAmount" INTEGER,
    "toMethod" "PaymentMethod" NOT NULL,
    "toCashAmount" INTEGER,
    "toQrisAmount" INTEGER,
    "reason" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentMethodChange_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentMethodChange" ADD CONSTRAINT "PaymentMethodChange_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentMethodChange" ADD CONSTRAINT "PaymentMethodChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PaymentMethodChange_orderId_idx" ON "PaymentMethodChange"("orderId");
