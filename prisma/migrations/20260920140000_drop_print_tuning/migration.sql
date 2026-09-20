-- Reverses 20260920100000_print_tuning. Measured on the real Blueprint ECO80D
-- (Tes Ketajaman, 20 Sep 2026): nine different ESC 7 / DC2 # combinations
-- printed absolutely identically, so this printer ignores both commands. The
-- smearing came from the double-height/double-width character sizes instead,
-- which the receipt no longer uses at all.
--
-- Safe to drop: the four columns were added the same day, were NULL in every
-- row, and nothing but the (now removed) "Ketajaman cetak" card ever wrote
-- them. Leaving a setting that provably does nothing would be worse than
-- losing it.
ALTER TABLE "Setting"
  DROP COLUMN "printDensity",
  DROP COLUMN "printHeatDots",
  DROP COLUMN "printHeatTime",
  DROP COLUMN "printHeatInterval";
