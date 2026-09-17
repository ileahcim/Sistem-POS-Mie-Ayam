import { prisma } from "@/lib/prisma";
import { MIE_FIXED_PRODUCT_TYPES, type MieProductType } from "./types";

export type MieProductDefaults = Record<Exclude<MieProductType, "CUSTOM">, number | null>;

// Null until the owner sets it from /note/produk — never guessed (same rule
// as Product.costPrice elsewhere). No DB row needs to exist yet for a
// product; a missing row just reads as null here.
export async function getMieProductDefaults(): Promise<MieProductDefaults> {
  const rows = await prisma.mieProductDefault.findMany();
  const map = new Map(rows.map((r) => [r.productType, r.defaultPricePerKg]));

  const result = {} as MieProductDefaults;
  for (const type of MIE_FIXED_PRODUCT_TYPES) {
    result[type] = map.get(type) ?? null;
  }
  return result;
}
