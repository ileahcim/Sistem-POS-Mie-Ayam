import { prisma } from "@/lib/prisma";
import { localDateStr, localTimeStr, wibDateRange } from "@/lib/timezone";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import type { TodayActivity } from "@/lib/note/today-activity";
import { formatMieJenisLabel, mieEntryHasItems, mieEntrySignedAmount, type MieLedgerEntryDTO, type MieProductType } from "./types";

// See TodayActivity. "Today" is the WIB calendar day of the moment the row
// was recorded (createdAt) — "what did I input today", not the business
// date the owner may have back-dated it to. Balances are over EVERY row of
// the customers who appear, same sum as the Utang tab.
export async function getMieTodayActivity(): Promise<TodayActivity<MieLedgerEntryDTO>> {
  const { start, end } = wibDateRange(localDateStr(new Date()));
  const entries = await prisma.mieLedgerEntry.findMany({
    where: { kind: { in: ["ORDER", "PAYMENT", "RETURN"] }, createdAt: { gte: start, lt: end } },
    include: { customer: { select: { id: true, name: true, isActive: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const customerIds = [...new Set(entries.map((e) => e.customerId))];
  const sums = await prisma.mieLedgerEntry.groupBy({
    by: ["customerId", "kind"],
    where: { customerId: { in: customerIds } },
    _sum: { amount: true },
  });
  const balances: Record<string, number> = {};
  for (const s of sums) {
    balances[s.customerId] = (balances[s.customerId] ?? 0) + mieEntrySignedAmount({ kind: s.kind, amount: s._sum.amount ?? 0 });
  }

  const rows = entries.map((e) => {
    const productType = e.productType as MieProductType | null;
    return {
      id: e.id,
      customerId: e.customer.id,
      customerName: e.customer.name,
      customerActive: e.customer.isActive,
      kind: e.kind as "ORDER" | "PAYMENT" | "RETURN",
      kindLabel: e.kind === "ORDER" ? "Pesanan" : e.kind === "RETURN" ? "Retur" : "Pembayaran",
      detail: mieEntryHasItems(e.kind)
        ? `${formatMieJenisLabel({ ...e, productType })}${e.kg != null ? ` · ${e.kg.toLocaleString("id-ID")} kg` : ""}`
        : formatNotePaymentMethod(e.paymentMethod),
      qty: mieEntryHasItems(e.kind) ? e.kg : null,
      amount: e.amount,
      time: localTimeStr(e.createdAt),
      createdAt: e.createdAt.toISOString(),
      entry: {
        id: e.id,
        kind: e.kind,
        paymentMethod: e.paymentMethod,
        productType,
        isPasar: e.isPasar,
        customLabel: e.customLabel,
        kg: e.kg,
        pricePerKg: e.pricePerKg,
        amount: e.amount,
        date: e.date.toISOString(),
        note: e.note,
        createdByName: e.createdBy.name,
      },
    };
  });

  return { rows, balances };
}
