import { prisma } from "@/lib/prisma";

// Frozen buku's default Rp/pcs, owner-editable from /note/produk. Null only
// if the singleton row somehow lost the value the migration seeded (9000).
export async function getFrozenPrice(): Promise<number | null> {
  const row = await prisma.mieSetting.findUnique({ where: { id: "singleton" } });
  return row?.frozenPricePerPcs ?? null;
}
