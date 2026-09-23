import { prisma } from "@/lib/prisma";
import { localDateStr, localTimeStr } from "@/lib/timezone";
import type { FrozenLedgerEntryDTO } from "./types";

// Mirrors MieReportPoint: the full entry DTO (so a drill-down row can be
// handed straight to the same FrozenEntrySheet the customer page uses)
// plus its customer and the derived time strings.
export type FrozenReportPoint = FrozenLedgerEntryDTO & {
  kind: "ORDER" | "PAYMENT";
  day: string; // "YYYY-MM-DD", Jakarta calendar date of the business date
  time: string; // "HH:MM" Jakarta, from createdAt — see get-mie-report.ts for why not `date`
  customerId: string;
  customerName: string;
};

// Raw points for Ringkasan Frozen — bucketed client-side (bucket-frozen.ts).
// Only ORDER (omzet) and PAYMENT (uang diterima) rows: opening balances and
// corrections are bookkeeping fixes, not sales or cash received. All
// customers, aktif and nonaktif. Nothing here touches the POS tables or the
// Mi Mentah ledger.
export async function getFrozenReportPoints(): Promise<{ points: FrozenReportPoint[]; today: string }> {
  const entries = await prisma.frozenLedgerEntry.findMany({
    where: { kind: { in: ["ORDER", "PAYMENT"] } },
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  return {
    today: localDateStr(new Date()),
    points: entries.map((e) => ({
      id: e.id,
      kind: e.kind as "ORDER" | "PAYMENT",
      paymentMethod: e.paymentMethod,
      pcs: e.pcs,
      pricePerPcs: e.pricePerPcs,
      amount: e.amount,
      date: e.date.toISOString(),
      note: e.note,
      createdByName: e.createdBy.name,
      day: localDateStr(e.date),
      time: localTimeStr(e.createdAt),
      customerId: e.customer.id,
      customerName: e.customer.name,
    })),
  };
}
