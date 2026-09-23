import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/timezone";

export type FrozenReportPoint = {
  day: string; // "YYYY-MM-DD", Jakarta calendar date of the ledger row's business date
  kind: "ORDER" | "PAYMENT";
  pcs: number;
  amount: number;
};

// Raw points for Ringkasan Frozen — bucketed client-side (bucket-frozen.ts).
// Only ORDER (omzet) and PAYMENT (uang diterima) rows: opening balances and
// corrections are bookkeeping fixes, not sales or cash received. All
// customers, aktif and nonaktif. Nothing here touches the POS tables or the
// Mi Mentah ledger.
export async function getFrozenReportPoints(): Promise<{ points: FrozenReportPoint[]; today: string }> {
  const entries = await prisma.frozenLedgerEntry.findMany({
    where: { kind: { in: ["ORDER", "PAYMENT"] } },
    select: { kind: true, pcs: true, amount: true, date: true },
    orderBy: { date: "asc" },
  });

  return {
    today: localDateStr(new Date()),
    points: entries.map((e) => ({
      day: localDateStr(e.date),
      kind: e.kind as "ORDER" | "PAYMENT",
      pcs: e.pcs ?? 0,
      amount: e.amount,
    })),
  };
}
