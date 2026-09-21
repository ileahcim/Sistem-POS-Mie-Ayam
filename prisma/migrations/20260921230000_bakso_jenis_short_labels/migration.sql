-- "Upgrade ke Urat" / "Upgrade ke Telur" become plain "Urat" / "Telur" in the
-- optional "Jenis Bakso" group (owner's request, 21 Sep 2026). Rename in place:
-- ids, prices and costPrice are untouched, so comboKeys, ComboCache and the
-- OrderItemAddon rows of past orders still line up. Past orders keep the name
-- they were sold under (OrderItemAddon.name is a snapshot, by design).
-- No-op on a fresh database (seed.ts creates the new names directly).
UPDATE "AddonOption" SET "name" = 'Urat'
WHERE "name" = 'Upgrade ke Urat'
  AND "addonGroupId" = (SELECT "id" FROM "AddonGroup" WHERE "name" = 'Jenis Bakso');

UPDATE "AddonOption" SET "name" = 'Telur'
WHERE "name" = 'Upgrade ke Telur'
  AND "addonGroupId" = (SELECT "id" FROM "AddonGroup" WHERE "name" = 'Jenis Bakso');

-- ComboCache keeps addon display names inside its JSON; refresh them so the
-- shortcut cache doesn't carry the old labels until the next shift close.
UPDATE "ComboCache"
SET "items" = replace(replace("items"::text,
      '"name": "Upgrade ke Urat"', '"name": "Urat"'),
      '"name": "Upgrade ke Telur"', '"name": "Telur"')::jsonb;
