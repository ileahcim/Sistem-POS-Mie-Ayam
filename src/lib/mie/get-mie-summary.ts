import { prisma } from "@/lib/prisma";
import { mieEntrySignedAmount } from "./types";

export type MieSummary = {
  // Sum of positive balances across ALL customers, aktif and nonaktif —
  // deactivating someone must never make their debt vanish from the
  // report. A credit customer (negative balance) isn't "receivable".
  totalReceivable: number;
  inactiveReceivable: number; // the part of totalReceivable owed by nonaktif customers
  debtorCount: number; // all customers currently owing, aktif + nonaktif
  inactiveDebtorCount: number;
  oldestDebtDays: number | null; // null when nobody currently owes anything
  oldestDebtSince: string | null; // ISO date, for display alongside the day count
};

// "Berapa lama utang tertua menggantung" can't be computed per-rupiah
// (payments are deliberately NOT matched to specific orders — see
// CLAUDE.md "Catatan Mi Mentah"), so this is an honest proxy: among
// customers who currently owe money, the earliest transaction date on
// their ledger. It answers "how long has this relationship been carrying a
// balance", not "how old is this exact rupiah of debt".
export async function getMieSummary(): Promise<MieSummary> {
  const customers = await prisma.mieCustomer.findMany({
    include: { entries: { select: { kind: true, amount: true, date: true } } },
  });

  let totalReceivable = 0;
  let inactiveReceivable = 0;
  let debtorCount = 0;
  let inactiveDebtorCount = 0;
  let oldestDebtSince: Date | null = null;

  for (const c of customers) {
    if (c.entries.length === 0) continue;
    const balance = c.entries.reduce((sum, e) => sum + mieEntrySignedAmount(e), 0);
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
