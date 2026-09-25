import { prisma } from "@/lib/prisma";
import { localDateStr, localTimeStr, wibDateRange } from "@/lib/timezone";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import type { TodayActivityRow } from "@/lib/note/today-activity";

// Frozen mirror of get-mie-today-activity.ts — the book calls an ORDER row
// "Pengambilan" everywhere else, so it does here too.
export async function getFrozenTodayActivity(): Promise<TodayActivityRow[]> {
  const { start, end } = wibDateRange(localDateStr(new Date()));
  const entries = await prisma.frozenLedgerEntry.findMany({
    where: { kind: { in: ["ORDER", "PAYMENT"] }, createdAt: { gte: start, lt: end } },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => ({
    id: e.id,
    customerId: e.customer.id,
    customerName: e.customer.name,
    kind: e.kind as "ORDER" | "PAYMENT",
    kindLabel: e.kind === "ORDER" ? "Pengambilan" : "Pembayaran",
    detail: e.kind === "ORDER" ? (e.pcs != null ? `${e.pcs.toLocaleString("id-ID")} pcs` : null) : formatNotePaymentMethod(e.paymentMethod),
    amount: e.amount,
    time: localTimeStr(e.createdAt),
    createdAt: e.createdAt.toISOString(),
  }));
}
