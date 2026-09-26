import { prisma } from "@/lib/prisma";
import { localDateStr, localTimeStr } from "@/lib/timezone";
import type { MieLedgerEntryDTO, MieProductType } from "./types";

// One ledger row as Ringkasan sees it: the FULL entry DTO (so the drill-down
// list can hand a row straight to the same EntrySheet the customer page
// uses — same edit/delete actions, same validation, no second path) plus
// who it belongs to and the two derived time strings the screen renders.
export type MieReportPoint = MieLedgerEntryDTO & {
  kind: "ORDER" | "PAYMENT" | "RETURN";
  day: string; // "YYYY-MM-DD", Jakarta calendar date of the business date — what bucketing groups by
  // "HH:MM" Jakarta, from createdAt — NOT from `date`: the business date is
  // stored as device-local midnight (dateInputToIso), so its clock component
  // is always 00:00 and would be a lie to print. This is when it was recorded.
  time: string;
  customerId: string;
  customerName: string;
};

// Raw points for the Ringkasan page — bucketed client-side (bucket-mie.ts)
// so switching Harian/Mingguan/Bulanan is instant. Only ORDER (omzet),
// RETURN (retur — taken off omzet/kg/margin) and PAYMENT (uang diterima) rows: opening balances and corrections are
// bookkeeping fixes, not sales or cash received. All customers, aktif and
// nonaktif — a sale doesn't un-happen because the customer was later
// deactivated. Nothing here touches the POS tables.
export async function getMieReportPoints(): Promise<{ points: MieReportPoint[]; today: string }> {
  const entries = await prisma.mieLedgerEntry.findMany({
    where: { kind: { in: ["ORDER", "PAYMENT", "RETURN"] } },
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
      kind: e.kind as "ORDER" | "PAYMENT" | "RETURN",
      paymentMethod: e.paymentMethod,
      // The DB enum still has the retired FROZEN value (existing rows, not
      // yet migrated — see types.ts) — bucket-mie.ts skips anything its
      // byType map doesn't recognize, so this cast is safe.
      productType: e.productType as MieProductType | null,
      isPasar: e.isPasar,
      customLabel: e.customLabel,
      kg: e.kg,
      pricePerKg: e.pricePerKg,
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
