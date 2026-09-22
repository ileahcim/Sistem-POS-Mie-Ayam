-- "Frozen" jenis for Catatan Mi Mentah (owner-approved, 22 Sep 2026): Mie
-- Frozen is a warung POS product, not raw mi mentah, so a customer's debt
-- for it stays tracked here (still real debt) but the Ringkasan's mi-mentah
-- omzet/kg totals exclude it — see bucket-mie.ts.
ALTER TYPE "MieProductType" ADD VALUE 'FROZEN';
