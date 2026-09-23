import { prisma } from "@/lib/prisma";
import type { BaksoUsageSettingValues } from "@/lib/dashboard/bakso-usage";

// Singleton row, same shape as Setting — see schema.prisma's
// BaksoUsageSetting doc comment and CLAUDE.md "Dashboard" for why this
// exists (owner-editable recipe numbers for the "Perkiraan Bakso Terpakai"
// estimate, not hardcoded).
export async function getBaksoUsageSetting(): Promise<BaksoUsageSettingValues> {
  const row = await prisma.baksoUsageSetting.findUniqueOrThrow({ where: { id: "singleton" } });
  return {
    baksoPolosKecil: row.baksoPolosKecil,
    baksoUratKecil: row.baksoUratKecil,
    baksoUratUrat: row.baksoUratUrat,
    baksoTelurKecil: row.baksoTelurKecil,
    baksoTelurTelur: row.baksoTelurTelur,
    toppingBaksoKecil: row.toppingBaksoKecil,
    toppingBaksoUratUrat: row.toppingBaksoUratUrat,
    toppingBaksoTelurTelur: row.toppingBaksoTelurTelur,
    baksoKecilProdukKecil: row.baksoKecilProdukKecil,
    baksoSetengahKecil: row.baksoSetengahKecil,
    baksoUratBijianUrat: row.baksoUratBijianUrat,
    baksoTelurBijianTelur: row.baksoTelurBijianTelur,
  };
}
