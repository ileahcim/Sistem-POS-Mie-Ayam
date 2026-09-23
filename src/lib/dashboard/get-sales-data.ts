import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/timezone";

export type DashboardOrderItem = {
  // Null for a custom item ("+ Item Custom") — see CLAUDE.md "Order & status".
  productId: string | null;
  productName: string; // typed name for a custom item, snapshot name otherwise
  qty: number;
  unitPrice: number;
  lineTotal: number;
  costPrice: number | null; // always null for a custom item — nothing to snapshot
  isDeliveryChargeable: boolean;
  addons: { name: string; price: number; costPrice: number | null }[];
};

export type DashboardOrder = {
  id: string;
  orderNumber: number;
  queueNumber: number | null;
  queueSuffix: string;
  day: string; // "YYYY-MM-DD", Jakarta calendar date of paidAt — what the shared range filter matches against
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  items: DashboardOrderItem[];
};

// Raw PAID-order data behind every period-filtered Dashboard section (Menu &
// Topping Terlaris, Margin, Item Custom, Per Channel) — fetched ONCE,
// unbounded (same "fetch everything, filter client-side" pattern as
// Ringkasan Mi Mentah's get-mie-report.ts), then filtered/aggregated
// client-side (aggregate-sales.ts) by the ONE shared date-range control so
// every section reads the identical set of orders and switching the range
// is instant, no round trip. VOID/RECEIVABLE/CANCELLED never appear — not
// sales (CLAUDE.md "Dashboard": "status: 'PAID' yang dihitung").
//
// Section 1 (Riwayat Shift) and 2 (Omzet) deliberately do NOT read from
// this — they're always the frozen Shift numbers, a different source of
// truth on purpose (CLAUDE.md "Aturan angka": a later void must never
// change an already-closed shift's report).
export async function getDashboardOrders(): Promise<{ orders: DashboardOrder[]; today: string }> {
  const orders = await prisma.order.findMany({
    where: { status: "PAID" },
    include: {
      items: {
        include: { addons: { select: { name: true, price: true, costPrice: true } } },
      },
    },
    orderBy: { paidAt: "asc" },
  });

  return {
    today: localDateStr(new Date()),
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      queueNumber: order.queueNumber,
      queueSuffix: order.queueSuffix,
      // paidAt is always set alongside status: "PAID" (payOrder writes both
      // atomically) — the createdAt fallback only guards a row that could
      // never actually occur, same defensive style as get-export-data.ts.
      day: localDateStr(order.paidAt ?? order.createdAt),
      channel: order.channel,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        costPrice: item.costPrice,
        isDeliveryChargeable: item.isDeliveryChargeable,
        addons: item.addons,
      })),
    })),
  };
}
