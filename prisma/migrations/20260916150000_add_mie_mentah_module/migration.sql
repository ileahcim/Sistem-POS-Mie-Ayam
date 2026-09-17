-- CreateEnum
CREATE TYPE "MieProductType" AS ENUM ('MIE_KERITING', 'MIE_LURUS', 'PANGSIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MieLedgerKind" AS ENUM ('ORDER', 'PAYMENT', 'OPENING_BALANCE');

-- CreateTable
CREATE TABLE "MieCustomer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MieCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MieProductDefault" (
    "productType" "MieProductType" NOT NULL,
    "defaultPricePerKg" INTEGER NOT NULL,

    CONSTRAINT "MieProductDefault_pkey" PRIMARY KEY ("productType")
);

-- CreateTable
CREATE TABLE "MieLedgerEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "MieLedgerKind" NOT NULL,
    "productType" "MieProductType",
    "customLabel" TEXT,
    "kg" DOUBLE PRECISION,
    "pricePerKg" INTEGER,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MieLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MieLedgerEntry" ADD CONSTRAINT "MieLedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MieCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MieLedgerEntry" ADD CONSTRAINT "MieLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

