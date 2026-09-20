-- Kasir reminder bar for pre-orders coming due. Minutes so 30 menit is
-- expressible; 120 keeps today's behaviour the owner asked for (2 jam).
ALTER TABLE "Setting"
  ADD COLUMN "preorderReminderMinutes" INTEGER NOT NULL DEFAULT 120;
