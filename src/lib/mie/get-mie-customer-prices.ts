import { prisma } from "@/lib/prisma";
import { MIE_FIXED_PRODUCT_TYPES, type MieProductType } from "./types";

export type MieSpecialPriceRow = {
  customerId: string;
  customerName: string;
  isActive: boolean;
  productType: Exclude<MieProductType, "CUSTOM">;
  pricePerKg: number;
};

// Every "harga khusus" of every customer, for Manajemen Menu's "Harga Khusus
// Pelanggan" table — the same MieCustomerPrice rows the customer page's
// sheet edits (one source, never a second copy). Nonaktif customers are
// included (their row still exists; the table marks them). Sorted by name,
// then jenis in the usual order.
export async function getMieSpecialPrices(): Promise<MieSpecialPriceRow[]> {
  const rows = await prisma.mieCustomerPrice.findMany({
    include: { customer: { select: { name: true, isActive: true } } },
  });
  const order = (t: string) => MIE_FIXED_PRODUCT_TYPES.indexOf(t as Exclude<MieProductType, "CUSTOM">);
  return rows
    .filter((r) => order(r.productType) >= 0)
    .map((r) => ({
      customerId: r.customerId,
      customerName: r.customer.name,
      isActive: r.customer.isActive,
      productType: r.productType as Exclude<MieProductType, "CUSTOM">,
      pricePerKg: r.pricePerKg,
    }))
    .sort(
      (a, b) =>
        a.customerName.localeCompare(b.customerName, "id", { sensitivity: "base" }) ||
        order(a.productType) - order(b.productType),
    );
}
