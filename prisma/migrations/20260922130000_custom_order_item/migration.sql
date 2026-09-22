-- "+ Item Custom" (CLAUDE.md-worthy brief, 22 Sep 2026): a free name/price
-- line the cashier types for something outside the menu. No real Product
-- backs it, so OrderItem.productId (and its FK) has to allow NULL. The FK
-- constraint itself already permits NULL values by default in Postgres —
-- only the NOT NULL needs dropping.
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;
