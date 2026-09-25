import { prisma } from "@/lib/prisma";
import { orderTotalFromLines } from "./order-total";

export type PosReceivableRow = {
  id: string;
  orderNumber: number;
  createdAt: string; // ISO — when the order was taken
  total: number;
};

// Unpaid POS piutang (Order status RECEIVABLE) whose guest name matches a
// Note customer's name — whole name, ignoring case and spacing ("Rose KMK" ≡
// "  rose  kmk", but not "Rose" or "Rosemary"). Read-only, purely for display on the Mi
// Mentah / Frozen customer page (25 Sep 2026): the three books (POS, Mi
// Mentah, Frozen) stay three separate sources and no balance anywhere
// includes these. One row per order, never summed into one number, so each
// keeps its own order number and opens its own detail.
// Stray/double spaces and letter case never matter ("  rose  kmk" ≡ "Rose
// KMK"). Compared in code rather than with a DB `equals`, which can't ignore
// whitespace — unpaid piutang are few, so reading them all is cheap.
function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function getPosReceivablesByName(name: string): Promise<PosReceivableRow[]> {
  const wanted = normalizeName(name);
  if (!wanted) return [];
  const receivables = await prisma.order.findMany({
    where: { status: "RECEIVABLE", customerName: { not: null } },
    include: { items: { select: { lineTotal: true, qty: true, isDeliveryChargeable: true } } },
    orderBy: { createdAt: "asc" },
  });
  const orders = receivables.filter((o) => normalizeName(o.customerName ?? "") === wanted);
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    total: orderTotalFromLines(o.items, o.channel),
  }));
}
