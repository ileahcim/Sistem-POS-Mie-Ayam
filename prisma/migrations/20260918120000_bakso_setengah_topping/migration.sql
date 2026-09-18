-- "Bakso Setengah (4 biji)" is a whole bowl (noodles, greens, broth) at half
-- size, so like a full Bakso it may take Pangsit/Ceker toppings. Only the
-- topping group — not "Jenis Bakso" (owner's call). sortOrder 3 matches the
-- position of "Topping Bakso" in prisma/seed.ts's addonGroups array.
INSERT INTO "ProductAddonGroup" ("id", "productId", "addonGroupId", "sortOrder")
SELECT gen_random_uuid()::text, p."id", g."id", 3
FROM "Product" p
JOIN "Category" c ON c."id" = p."categoryId" AND c."name" = 'Makanan'
CROSS JOIN "AddonGroup" g
WHERE p."name" = 'Bakso Setengah (4 biji)'
  AND g."name" = 'Topping Bakso'
ON CONFLICT ("productId", "addonGroupId") DO NOTHING;
