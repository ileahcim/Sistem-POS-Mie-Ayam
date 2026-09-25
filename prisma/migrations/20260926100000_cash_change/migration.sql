-- "Hitung kembalian" (26 Sep 2026). Purely additive: a new Setting switch
-- (on by default, per the owner) and two nullable columns on PreorderDeposit.
-- Order already has cashTendered/changeGiven; no existing row changes.
ALTER TABLE "Setting" ADD COLUMN "cashChangeEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PreorderDeposit" ADD COLUMN "cashTendered" INTEGER,
ADD COLUMN "changeGiven" INTEGER;
