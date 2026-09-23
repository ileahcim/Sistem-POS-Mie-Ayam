-- Split payment ("Cash + QRIS", CLAUDE.md-worthy brief, 22 Sep 2026): one
-- order, one payment, two methods at once when the customer's cash falls
-- short. Additive only — every existing CASH/QRIS/TRANSFER order is
-- untouched, both new columns stay NULL for them.
ALTER TYPE "PaymentMethod" ADD VALUE 'SPLIT';

ALTER TABLE "Order" ADD COLUMN "splitCashAmount" INTEGER;
ALTER TABLE "Order" ADD COLUMN "splitQrisAmount" INTEGER;
