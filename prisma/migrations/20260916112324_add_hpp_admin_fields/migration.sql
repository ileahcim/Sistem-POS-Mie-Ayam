-- AlterTable
ALTER TABLE "AddonOption" ADD COLUMN     "costPriceEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marginIntentional" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPriceEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marginIntentional" BOOLEAN NOT NULL DEFAULT false;
