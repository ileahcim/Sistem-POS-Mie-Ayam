-- "Buka laci otomatis" (2 Nov 2026). Purely additive: one Setting switch,
-- on by default = the behaviour shipped in c4f85e3 (drawer opens by itself
-- whenever cash moves). No existing row or column changes.
ALTER TABLE "Setting" ADD COLUMN "autoOpenDrawer" BOOLEAN NOT NULL DEFAULT true;
