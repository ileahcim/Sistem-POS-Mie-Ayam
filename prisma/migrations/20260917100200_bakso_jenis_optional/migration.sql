-- "Jenis Bakso" becomes optional (pick nothing = plain Bakso at base price).
-- Options keep their ids (so comboKeys, ComboCache and historical
-- OrderItemAddon rows still line up) and their price/costPrice — only the
-- display name changes. "Biasa" is soft-deleted, never hard-deleted, so
-- any historical order that used it still references a real row.
-- No-ops on a fresh database (seed.ts creates the new shape directly).
UPDATE "AddonGroup" SET "minSelect" = 0, "maxSelect" = 1 WHERE "name" = 'Jenis Bakso';

UPDATE "AddonOption" SET "name" = 'Upgrade ke Urat', "sortOrder" = 0
WHERE "name" = 'Urat'
  AND "addonGroupId" = (SELECT "id" FROM "AddonGroup" WHERE "name" = 'Jenis Bakso');

UPDATE "AddonOption" SET "name" = 'Upgrade ke Telur', "sortOrder" = 1
WHERE "name" = 'Telur'
  AND "addonGroupId" = (SELECT "id" FROM "AddonGroup" WHERE "name" = 'Jenis Bakso');

UPDATE "AddonOption" SET "isActive" = false
WHERE "name" = 'Biasa'
  AND "addonGroupId" = (SELECT "id" FROM "AddonGroup" WHERE "name" = 'Jenis Bakso');

-- ComboCache stores addon display names inside its JSON; refresh them so
-- the shortcut cards don't keep showing the old "Urat"/"Telur" labels until
-- the next shift close.
UPDATE "ComboCache"
SET "items" = replace(replace("items"::text,
      '"name": "Urat"', '"name": "Upgrade ke Urat"'),
      '"name": "Telur"', '"name": "Upgrade ke Telur"')::jsonb;
