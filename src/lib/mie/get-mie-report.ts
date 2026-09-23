import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/timezone";
import type { MieProductType } from "./types";

export type MieReportPoint = {
  day: string; // "YYYY-MM-DD", Jakarta calendar date of the ledger row's business date
  kind: "ORDER" | "PAYMENT";
  productType: MieProductType | null;
  kg: number;
  amount: number;
};

// Raw points for the Ringkasan page — bucketed client-side (bucket-mie.ts)
// so switching Harian/Mingguan/Bulanan is instant. Only ORDER (omzet) and
// PAYMENT (uang diterima) rows: opening balances and corrections are
// bookkeeping fixes, not sales or cash received. All customers, aktif and
// nonaktif — a sale doesn't un-happen because the customer was later
// deactivated. Nothing here touches the POS tables.
export async function getMieReportPoints(): Promise<{ points: MieReportPoint[]; today: string }> {
  const entries = await prisma.mieLedgerEntry.findMany({
    where: { kind: { in: ["ORDER", "PAYMENT"] } },
    select: { kind: true, productType: true, kg: true, amount: true, date: true },
    orderBy: { date: "asc" },
  });

  return {
    today: localDateStr(new Date()),
    points: entries.map((e) => ({
      day: localDateStr(e.date),
      kind: e.kind as "ORDER" | "PAYMENT",
      // The DB enum still has the retired FROZEN value (existing rows, not
      // yet migrated — see types.ts) — bucket-mie.ts skips anything its
      // byType map doesn't recognize, so this cast is safe.
      productType: e.productType as MieProductType | null,
      kg: e.kg ?? 0,
      amount: e.amount,
    })),
  };
}
