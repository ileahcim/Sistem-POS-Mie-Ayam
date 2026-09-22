import { prisma } from "@/lib/prisma";
import { wibDateRange, localDateStr } from "@/lib/timezone";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "./pricing";

const HISTORY_STATUSES = ["PAID", "VOID", "RECEIVABLE", "CANCELLED"] as const;
export type HistoryStatus = (typeof HISTORY_STATUSES)[number];

export type OrderHistoryRow = {
  id: string;
  orderNumber: number;
  queueNumber: number | null;
  queueSuffix: string;
  createdAt: string; // "Dipesan" — when the order was first created
  paidAt: string | null; // "Dibayar" — PAID and VOID orders (void keeps its original payment time)
  voidedAt: string | null;
  cancelledAt: string | null;
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  customerName: string | null;
  total: number;
  status: HistoryStatus;
};

// "Waktu terakhir statusnya berubah" (CLAUDE.md-worthy brief, 22 Sep 2026):
// a PAID order is done once paid; a VOIDed one concludes later, at voidedAt;
// a CANCELLED one at cancelledAt; RECEIVABLE has no dedicated timestamp (set
// only as a side effect of closeShift), so its own last-write time is the
// closest thing to "when it settled". Priority favors whichever event
// happened LAST for that order, not just whichever field happens to be set —
// a VOID order has both paidAt and voidedAt, and it's the void (later) that
// should place it in the list, not the original payment.
function settledAtOf(order: { paidAt: Date | null; voidedAt: Date | null; cancelledAt: Date | null; updatedAt: Date }): Date {
  return order.voidedAt ?? order.cancelledAt ?? order.paidAt ?? order.updatedAt;
}

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
// voided, cancelled while still unpaid, or marked as receivable at shift close) — an OPEN order is still
// live business tracked on Order Aktif, not history yet.
export async function getOrderHistory(filter: OrderHistoryFilter): Promise<OrderHistoryRow[]> {
  const { start } = wibDateRange(filter.dateFrom);
  const { end } = wibDateRange(filter.dateTo);
  const search = filter.search.trim();
  const searchAsOrderNumber = search !== "" && /^\d+$/.test(search) ? Number(search) : null;

  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...HISTORY_STATUSES] },
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

  return orders
    .map((order) => {
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
        paidAt: order.paidAt?.toISOString() ?? null,
        voidedAt: order.voidedAt?.toISOString() ?? null,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        channel: order.channel,
        tableLabel: order.tableLabel,
        customerName: order.customerName,
        total: subtotal + deliveryFee,
        status: order.status as HistoryStatus,
        _settledAt: settledAtOf(order),
      };
    })
    .sort((a, b) => b._settledAt.getTime() - a._settledAt.getTime())
    .map(({ _settledAt, ...row }) => row);
}
