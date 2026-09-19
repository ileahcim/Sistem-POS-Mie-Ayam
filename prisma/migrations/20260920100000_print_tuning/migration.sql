-- Thermal head tuning sent at the start of every print job. NULL = send nothing
-- (printer keeps its own factory value), so existing behaviour is unchanged.
-- printDensity -> DC2 # n (0-31); heat* -> ESC 7 n1 n2 n3.
ALTER TABLE "Setting"
  ADD COLUMN "printDensity" INTEGER,
  ADD COLUMN "printHeatDots" INTEGER,
  ADD COLUMN "printHeatTime" INTEGER,
  ADD COLUMN "printHeatInterval" INTEGER;
