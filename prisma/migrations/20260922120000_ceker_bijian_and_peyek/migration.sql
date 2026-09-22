-- Two new products, owner-approved 22 Sep 2026 (satuan pelengkap, not part
-- of the Bakso upgrade paket — see CLAUDE.md "Tambah Bakso maksimal 1").

-- "Ceker (bijian)" sits right after the other bijian items in Makanan
-- (Bakso Urat/Telur (bijian), sortOrder 4/5), before "Bakso Kecil (3 biji)"
-- — make room at sortOrder 6 by shifting everything from there up by one.
UPDATE "Product" SET "sortOrder" = "sortOrder" + 1
WHERE "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Makanan')
  AND "sortOrder" >= 6;

INSERT INTO "Product" ("id", "categoryId", "name", "price", "costPrice", "costPriceEstimated", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'Ceker (bijian)', 2000, 1000, false, 6, true, now(), now()
FROM "Category" c WHERE c."name" = 'Makanan';

-- "Peyek" goes in Lain-lain, right after the Kerupuk items (sortOrder 1, 2
-- currently — nothing else follows them, so it lands at the end, no shift
-- needed). costPrice is genuinely unknown yet (owner hasn't priced raw
-- peyek), left NULL — not 0, which would read as a CONFIRMED zero-cost item
-- and hide it from the Dashboard Margin section's "HPP belum diisi" banner
-- (get-margin-report.ts checks costPrice == null, not === 0).
INSERT INTO "Product" ("id", "categoryId", "name", "price", "costPrice", "costPriceEstimated", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'Peyek', 2000, NULL, false, 3, true, now(), now()
FROM "Category" c WHERE c."name" = 'Lain-lain';
