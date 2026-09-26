import { prisma } from "@/lib/prisma";
import { localDateStr, localTimeStr, wibDateRange } from "@/lib/timezone";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import type { TodayActivity } from "@/lib/note/today-activity";
import { frozenEntrySignedAmount, type FrozenLedgerEntryDTO } from "./types";

// Frozen mirror of get-mie-today-activity.ts — the book calls an ORDER row
// "Pengambilan" everywhere else, so it does here too.
export async function getFrozenTodayActivity(): Promise<TodayActivity<FrozenLedgerEntryDTO>> {
  const { start, end } = wibDateRange(localDateStr(new Date()));
  const entries = await prisma.frozenLedgerEntry.findMany({
    where: { kind: { in: ["ORDER", "PAYMENT"] }, createdAt: { gte: start, lt: end } },
    include: { customer: { select: { id: true, name: true, isActive: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const customerIds = [...new Set(entries.map((e) => e.customerId))];
  const sums = await prisma.frozenLedgerEntry.groupBy({
    by: ["customerId", "kind"],
    where: { customerId: { in: customerIds } },
    _sum: { amount: true },
  });
  const balances: Record<string, number> = {};
  for (const s of sums) {
    balances[s.customerId] =
      (balances[s.customerId] ?? 0) + frozenEntrySignedAmount({ kind: s.kind, amount: s._sum.amount ?? 0 });
  }

  const rows = entries.map((e) => ({
    id: e.id,
    customerId: e.customer.id,
    customerName: e.customer.name,
    customerActive: e.customer.isActive,
    kind: e.kind as "ORDER" | "PAYMENT",
    kindLabel: e.kind === "ORDER" ? "Pengambilan" : "Pembayaran",
    detail: e.kind === "ORDER" ? (e.pcs != null ? `${e.pcs.toLocaleString("id-ID")} pcs` : null) : formatNotePaymentMethod(e.paymentMethod),
    qty: e.kind === "ORDER" ? e.pcs : null,
    amount: e.amount,
    time: localTimeStr(e.createdAt),
    createdAt: e.createdAt.toISOString(),
    entry: {
      id: e.id,
      kind: e.kind,
      paymentMethod: e.paymentMethod,
      pcs: e.pcs,
      pricePerPcs: e.pricePerPcs,
      amount: e.amount,
      date: e.date.toISOString(),
      note: e.note,
      createdByName: e.createdBy.name,
    },
  }));

  return { rows, balances };
}
