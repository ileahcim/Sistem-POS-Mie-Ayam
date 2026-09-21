import { prisma } from "@/lib/prisma";

// Every number here is read straight off the frozen Shift row, never
// recomputed from Order — see CLAUDE.md "Dashboard": a later void must
// never change a report for a shift that's already closed, and the owner
// needs these numbers to always match what was true the moment the shift
// closed, not "corrected" by anything that happened since.
export type ShiftHistoryRow = {
  id: string;
  openedAt: string;
  closedAt: string;
  openedByName: string;
  openingCash: number;
  cashSales: number;
  nonCashSales: number;
  expenseTotal: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  // Pre-order DP, frozen too. 0 for every shift that closed before DP existed
  // (the columns are NULL there and are never recomputed).
  depositsAppliedCash: number;
  depositsReceivedCash: number;
  depositRefundsCash: number;
  forfeitedDeposits: number;
};

export async function getShiftHistory(limit = 30): Promise<ShiftHistoryRow[]> {
  const shifts = await prisma.shift.findMany({
    where: { status: "CLOSED" },
    orderBy: { openedAt: "desc" },
    take: limit,
    include: { openedBy: true },
  });

  return shifts.map((s) => ({
    id: s.id,
    openedAt: s.openedAt.toISOString(),
    closedAt: (s.closedAt ?? s.openedAt).toISOString(),
    openedByName: s.openedBy.name,
    openingCash: s.openingCash,
    cashSales: s.cashSales ?? 0,
    nonCashSales: s.nonCashSales ?? 0,
    expenseTotal: s.expenseTotal ?? 0,
    expectedCash: s.expectedCash ?? 0,
    countedCash: s.countedCash ?? 0,
    difference: s.difference ?? 0,
    depositsAppliedCash: s.depositsAppliedCash ?? 0,
    depositsReceivedCash: s.depositsReceivedCash ?? 0,
    depositRefundsCash: s.depositRefundsCash ?? 0,
    forfeitedDeposits: s.forfeitedDeposits ?? 0,
  }));
}
