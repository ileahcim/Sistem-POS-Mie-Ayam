import { prisma } from "@/lib/prisma";
import { localDateStr, localTimeStr, wibDateRange } from "@/lib/timezone";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import type { TodayActivityRow } from "@/lib/note/today-activity";
import { formatMieEntryLabel, type MieProductType } from "./types";

// See TodayActivityRow. "Today" is the WIB calendar day of the moment the
// row was recorded (createdAt) — "what did I input today", not the business
// date the owner may have back-dated it to.
export async function getMieTodayActivity(): Promise<TodayActivityRow[]> {
  const { start, end } = wibDateRange(localDateStr(new Date()));
  const entries = await prisma.mieLedgerEntry.findMany({
    where: { kind: { in: ["ORDER", "PAYMENT"] }, createdAt: { gte: start, lt: end } },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => ({
    id: e.id,
    customerId: e.customer.id,
    customerName: e.customer.name,
    kind: e.kind as "ORDER" | "PAYMENT",
    kindLabel: e.kind === "ORDER" ? "Pesanan" : "Pembayaran",
    detail:
      e.kind === "ORDER"
        ? `${formatMieEntryLabel({ ...e, productType: e.productType as MieProductType | null })}${
            e.kg != null ? ` · ${e.kg.toLocaleString("id-ID")} kg` : ""
          }`
        : formatNotePaymentMethod(e.paymentMethod),
    amount: e.amount,
    time: localTimeStr(e.createdAt),
    createdAt: e.createdAt.toISOString(),
  }));
}
