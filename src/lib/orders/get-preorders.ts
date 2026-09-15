import { prisma } from "@/lib/prisma";

export type PreOrderSummary = {
  id: string;
  scheduledFor: string;
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  customerName: string | null;
  status: "OPEN" | "PAID";
  itemSummary: string;
};

// "Pesanan Terjadwal" tab — pre-orders not yet due. The moment scheduledFor
// arrives, an order drops out of this list and picks up in getActiveOrders()
// instead (see CLAUDE.md "Pre-order") — no explicit "activation" step, the
// two queries are just mirror images of the same cutoff.
export async function getUpcomingPreOrders(): Promise<PreOrderSummary[]> {
  const orders = await prisma.order.findMany({
    where: {
      scheduledFor: { gt: new Date() },
      status: { in: ["OPEN", "PAID"] },
    },
    orderBy: { scheduledFor: "asc" },
    include: { items: true },
  });

  return orders.map((order) => ({
    id: order.id,
    scheduledFor: order.scheduledFor!.toISOString(),
    channel: order.channel,
    tableLabel: order.tableLabel,
    customerName: order.customerName,
    status: order.status as "OPEN" | "PAID",
    itemSummary: order.items
      .map((i) => (i.qty > 1 ? `${i.productName} x${i.qty}` : i.productName))
      .join(", "),
  }));
}
