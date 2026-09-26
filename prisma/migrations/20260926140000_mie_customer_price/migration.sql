-- "Harga khusus" per pelanggan Mi Mentah (26 Sep 2026). Purely additive: one
-- new table, no existing table or row changes. A customer's special Rp/kg per
-- jenis, read only by the new-order form's price autofill.
CREATE TABLE "MieCustomerPrice" (
    "customerId" TEXT NOT NULL,
    "productType" "MieProductType" NOT NULL,
    "pricePerKg" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MieCustomerPrice_pkey" PRIMARY KEY ("customerId","productType")
);

ALTER TABLE "MieCustomerPrice" ADD CONSTRAINT "MieCustomerPrice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MieCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
