import { prisma } from "@/lib/prisma";

// Raw per-shift points (frozen Shift numbers, same rule as
// get-shift-history.ts) over a wide window — bucketed into
// harian/mingguan/bulanan client-side by bucket-omzet.ts so switching the
// chart's range doesn't need a round trip.
export type OmzetShiftPoint = {
  openedAt: string;
  cashSales: number;
  nonCashSales: number;
  // "DP hangus": DP kept from a cancelled pre-order, recognised on the day of
  // cancellation. Revenue, but never a food sale — it sits apart from
  // cashSales/nonCashSales and is added to omzet here.
  forfeitedDeposits: number;
};

export async function getOmzetHistory(days = 400): Promise<OmzetShiftPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const shifts = await prisma.shift.findMany({
    where: { status: "CLOSED", openedAt: { gte: since } },
    orderBy: { openedAt: "asc" },
    select: { openedAt: true, cashSales: true, nonCashSales: true, forfeitedDeposits: true },
  });

  return shifts.map((s) => ({
    openedAt: s.openedAt.toISOString(),
    cashSales: s.cashSales ?? 0,
    nonCashSales: s.nonCashSales ?? 0,
    forfeitedDeposits: s.forfeitedDeposits ?? 0,
  }));
}
