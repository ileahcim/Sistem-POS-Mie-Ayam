-- Active print driver: "webbluetooth" (default, no helper app / watermark) |
-- "rawbt" (Android RawBT app, Classic SPP fallback) | "mock" (screen preview).
ALTER TABLE "Setting" ADD COLUMN "printerDriver" TEXT NOT NULL DEFAULT 'webbluetooth';