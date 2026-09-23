import { prisma } from "@/lib/prisma";
import { frozenEntrySignedAmount } from "./types";

export type FrozenSummary = {
  totalReceivable: number;
  inactiveReceivable: number;
  debtorCount: number;
  inactiveDebtorCount: number;
  oldestDebtDays: number | null;
  oldestDebtSince: string | null;
};

// Mirrors get-mie-summary.ts exactly — same "nonaktif still counts" rule.
export async function getFrozenSummary(): Promise<FrozenSummary> {
  const customers = await prisma.frozenCustomer.findMany({
    include: { entries: { select: { kind: true, amount: true, date: true } } },
  });

  let totalReceivable = 0;
  let inactiveReceivable = 0;
  let debtorCount = 0;
  let inactiveDebtorCount = 0;
  let oldestDebtSince: Date | null = null;

  for (const c of customers) {
    if (c.entries.length === 0) continue;
    const balance = c.entries.reduce((sum, e) => sum + frozenEntrySignedAmount(e), 0);
    if (balance <= 0) continue;

    totalReceivable += balance;
    debtorCount += 1;
    if (!c.isActive) {
      inactiveReceivable += balance;
      inactiveDebtorCount += 1;
    }
    const earliest = c.entries.reduce((min, e) => (e.date < min ? e.date : min), c.entries[0].date);
    if (oldestDebtSince === null || earliest < oldestDebtSince) oldestDebtSince = earliest;
  }

  const oldestDebtDays =
    oldestDebtSince === null
      ? null
      : Math.max(0, Math.floor((Date.now() - oldestDebtSince.getTime()) / (24 * 60 * 60 * 1000)));

  return {
    totalReceivable,
    inactiveReceivable,
    debtorCount,
    inactiveDebtorCount,
    oldestDebtDays,
    oldestDebtSince: oldestDebtSince?.toISOString() ?? null,
  };
}
