-- Two menu-data corrections from the owner. No schema change: only rows.

-- 1) "Topping Mie" mixed two different kinds of choice. Bakso / Bakso Urat /
--    Bakso Telur are an UPGRADE of the one bakso in the bowl — at most one,
--    and they replace each other — while Pangsit / Ceker are real toppings
--    that may be ordered several of. A single unlimited group rendered all
--    five as steppers, which let the cashier tap "Bakso Urat 1 + Bakso Telur
--    2" on one bowl. Split the upgrades into their own pick-one group
--    (maxSelect 1 => radio buttons on the cashier screen).
--
--    The options are MOVED, not recreated: their ids stay the same, so every
--    existing OrderItemAddon snapshot, every ComboCache comboKey, and every
--    filled-in HPP cost price keeps pointing at the same row.
INSERT INTO "AddonGroup" ("id", "name", "minSelect", "maxSelect", "createdAt")
SELECT gen_random_uuid()::text, 'Tambah Bakso', 0, 1, now()
WHERE NOT EXISTS (SELECT 1 FROM "AddonGroup" WHERE "name" = 'Tambah Bakso');

UPDATE "AddonOption" o
SET "addonGroupId" = (SELECT "id" FROM "AddonGroup" WHERE "name" = 'Tambah Bakso'),
    "sortOrder" = CASE o."name" WHEN 'Bakso' THEN 0 WHEN 'Bakso Urat' THEN 1 ELSE 2 END
FROM "AddonGroup" g
WHERE g."id" = o."addonGroupId"
  AND g."name" = 'Topping Mie'
  AND o."name" IN ('Bakso', 'Bakso Urat', 'Bakso Telur');

-- What's left in "Topping Mie" is the real topping list; keep it in order.
UPDATE "AddonOption" o
SET "sortOrder" = CASE o."name" WHEN 'Pangsit' THEN 0 ELSE 1 END
FROM "AddonGroup" g
WHERE g."id" = o."addonGroupId" AND g."name" = 'Topping Mie';

-- The new group attaches to exactly the products "Topping Mie" already
-- attaches to (Mie Ayam, Pangsit Rebus, Ceker — the rule is the same for all
-- three, not just Mie Ayam) and sits above it in the sheet.
INSERT INTO "ProductAddonGroup" ("id", "productId", "addonGroupId", "sortOrder")
SELECT
  gen_random_uuid()::text,
  pag."productId",
  (SELECT "id" FROM "AddonGroup" WHERE "name" = 'Tambah Bakso'),
  0
FROM "ProductAddonGroup" pag
JOIN "AddonGroup" g ON g."id" = pag."addonGroupId"
WHERE g."name" = 'Topping Mie'
ON CONFLICT ("productId", "addonGroupId") DO NOTHING;

-- Every link row gets an explicit position now (they were all 0 before, so
-- the sheet's group order depended on whatever the database happened to
-- return). Same order as prisma/seed.ts's `addonGroups` array.
UPDATE "ProductAddonGroup" pag
SET "sortOrder" = CASE g."name"
  WHEN 'Tambah Bakso' THEN 0
  WHEN 'Topping Mie' THEN 1
  WHEN 'Jenis Bakso' THEN 2
  WHEN 'Topping Bakso' THEN 3
  ELSE pag."sortOrder"
END
FROM "AddonGroup" g
WHERE g."id" = pag."addonGroupId";

-- 2) Two smaller portions, placed right after the existing by-the-piece rows
--    at the bottom of Makanan.
--
--    "Bakso Kecil (3 biji)" is loose balls only: 3 x Rp1.100 = Rp3.300, the
--    same per-ball cost as the Rp5.000-per-3 raw price.
--    "Bakso Setengah (4 biji)" is a whole bowl (noodles, greens, broth) at
--    half size, so its cost is half of a full Bakso's Rp10.000, not just the
--    balls — Rp8.000 - Rp5.000 = Rp3.000 profit, the same shape as the rest
--    of the menu.
--
--    Both cost prices are the owner's estimate, hence costPriceEstimated.
INSERT INTO "Product" (
  "id", "categoryId", "name", "price", "costPrice", "costPriceEstimated",
  "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, c."id", v.name, v.price, v.cost, true, v.sort, true, now(), now()
FROM "Category" c
CROSS JOIN (VALUES
  ('Bakso Kecil (3 biji)', 5000, 3300, 6),
  ('Bakso Setengah (4 biji)', 8000, 5000, 7)
) AS v(name, price, cost, sort)
WHERE c."name" = 'Makanan'
  AND NOT EXISTS (
    SELECT 1 FROM "Product" p WHERE p."name" = v.name AND p."categoryId" = c."id"
  );
