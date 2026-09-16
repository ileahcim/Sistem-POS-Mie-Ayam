import { prisma } from "@/lib/prisma";
import { wibDateRange, localDateStr } from "@/lib/timezone";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "./pricing";

export type OrderHistoryRow = {
  id: string;
  orderNumber: number;
  queueNumber: number | null;
  queueSuffix: string;
  createdAt: string;
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  customerName: string | null;
  total: number;
  status: "PAID" | "VOID" | "RECEIVABLE";
};

export type OrderHistoryFilter = {
  dateFrom: string; // "YYYY-MM-DD", Jakarta calendar date, inclusive
  dateTo: string; // "YYYY-MM-DD", Jakarta calendar date, inclusive
  search: string; // matches order number (exact) or guest name (contains)
};

// CASHIER only ever sees today's history — enforced here, not just by
// hiding the date pickers in the UI (same requireRole-style principle as
// CLAUDE.md "Server-side authorization": a cashier session that edits the
// URL's ?from=/&to= must still never get a query reaching past today).
// Call this on every read, list or single-order detail alike.
export function clampHistoryFilterForRole(filter: OrderHistoryFilter, isOwner: boolean): OrderHistoryFilter {
  if (isOwner) return filter;
  const today = localDateStr(new Date());
  return { ...filter, dateFrom: today, dateTo: today };
}

// Riwayat Pesanan only lists orders that have actually concluded (paid,
// voided, or marked as receivable at shift close) — an OPEN order is still
// live business tracked on Order Aktif, not history yet.
export async function getOrderHistory(filter: OrderHistoryFilter): Promise<OrderHistoryRow[]> {
  const { start } = wibDateRange(filter.dateFrom);
  const { end } = wibDateRange(filter.dateTo);
  const search = filter.search.trim();
  const searchAsOrderNumber = search !== "" && /^\d+$/.test(search) ? Number(search) : null;

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["PAID", "VOID", "RECEIVABLE"] },
      createdAt: { gte: start, lt: end },
      ...(search
        ? {
            OR: [
              ...(searchAsOrderNumber !== null ? [{ orderNumber: searchAsOrderNumber }] : []),
              { customerName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return orders.map((order) => {
    const subtotal = order.items.reduce((sum, i) => sum + i.lineTotal, 0);
    const deliveryFee =
      order.channel === "ANTAR"
        ? order.items.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) * DELIVERY_FEE_PER_FOOD_ITEM
        : 0;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      queueNumber: order.queueNumber,
      queueSuffix: order.queueSuffix,
      createdAt: order.createdAt.toISOString(),
      channel: order.channel,
      tableLabel: order.tableLabel,
      customerName: order.customerName,
      total: subtotal + deliveryFee,
      status: order.status as "PAID" | "VOID" | "RECEIVABLE",
    };
  });
}
