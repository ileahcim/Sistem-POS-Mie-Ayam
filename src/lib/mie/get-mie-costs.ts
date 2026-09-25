import { prisma } from "@/lib/prisma";
import type { MieCosts } from "./types";

// Modal per kg, read LIVE (never snapshotted on ledger rows — one number
// per jenis that rarely changes; see MieProductDefault.costPerKg). Null =
// "belum diisi": a missing DB row reads the same as an empty column.
export async function getMieCosts(): Promise<MieCosts> {
  const [defaults, setting] = await Promise.all([
    prisma.mieProductDefault.findMany({ select: { productType: true, costPerKg: true } }),
    prisma.mieSetting.findUnique({ where: { id: "singleton" }, select: { pasarCostPerKg: true } }),
  ]);
  const byType = new Map(defaults.map((d) => [d.productType as string, d.costPerKg]));
  return {
    MIE_KERITING: byType.get("MIE_KERITING") ?? null,
    MIE_LURUS: byType.get("MIE_LURUS") ?? null,
    PANGSIT: byType.get("PANGSIT") ?? null,
    MIE_PASAR: setting?.pasarCostPerKg ?? null,
  };
}
