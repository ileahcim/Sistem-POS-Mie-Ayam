-- Bungkus/Antar are now considered done the moment they're paid (payOrder
-- fills servedAt automatically). Backfill already-paid takeaway orders that
-- were never manually marked served, so they don't linger on Order Aktif.
UPDATE "Order"
SET "servedAt" = "paidAt"
WHERE "status" = 'PAID'
  AND "channel" IN ('BUNGKUS', 'ANTAR')
  AND "servedAt" IS NULL
  AND "paidAt" IS NOT NULL;
