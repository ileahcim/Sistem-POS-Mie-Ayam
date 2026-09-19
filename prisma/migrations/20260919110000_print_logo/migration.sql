-- Owner-toggle: print the store logo on the struk/daftar packing header or
-- fall back to a text-only header. Default on, same as the current behaviour.
ALTER TABLE "Setting" ADD COLUMN "printLogo" BOOLEAN NOT NULL DEFAULT true;