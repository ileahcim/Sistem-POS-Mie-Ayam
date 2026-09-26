import { prisma } from "@/lib/prisma";

// Which jenis button the Pesanan Baru / Retur Baru form starts on for each
// customer: the jenis of their LAST pesanan (26 Sep 2026, owner's request —
// "Pasar" orders Mi Pasar every day, but the form kept opening on Mi Keriting
// at the general 17.000). Mi Pasar counts as its own choice; Custom is never
// a default (it needs a name typed each time). A customer with no pesanan
// yet is missing here — the form falls back to Mi Keriting.
export type MieDefaultJenis = "MIE_KERITING" | "MIE_LURUS" | "PANGSIT" | "PASAR";

export async function getMieDefaultJenis(): Promise<Record<string, MieDefaultJenis>> {
  const rows = await prisma.mieLedgerEntry.findMany({
    where: { kind: "ORDER", productType: { in: ["MIE_KERITING", "MIE_LURUS", "PANGSIT"] }, customer: { isActive: true } },
    orderBy: [{ customerId: "asc" }, { date: "desc" }, { createdAt: "desc" }],
    distinct: ["customerId"],
    select: { customerId: true, productType: true, isPasar: true },
  });
  const result: Record<string, MieDefaultJenis> = {};
  for (const r of rows) {
    result[r.customerId] = r.productType === "MIE_KERITING" && r.isPasar ? "PASAR" : (r.productType as MieDefaultJenis);
  }
  return result;
}
