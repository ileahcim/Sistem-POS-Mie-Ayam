import { prisma } from "@/lib/prisma";

export type ActiveOrderItem = {
  productName: string;
  qty: number;
};

export type ActiveOrder = {
  id: string;
  queueNumber: number;
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  createdAt: string; // ISO — serializable across the server/client boundary
  status: "OPEN" | "PAID";
  totalQty: number;
  portionsToCook: number; // qty summed over Makanan/Minuman Racik lines only
  items: ActiveOrderItem[];
};

// "Order Aktif" = food not yet served, regardless of payment status (paid
// and unpaid are independent axes). Void/receivable orders never need
// serving. Pre-orders not yet due (scheduledFor in the future) belong on
// the separate "Pesanan Terjadwal" tab (stage 9), not here.
export async function getActiveOrders(): Promise<ActiveOrder[]> {
  const orders = await prisma.order.findMany({
    where: {
      servedAt: null,
      status: { in: ["OPEN", "PAID"] },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });

  return orders.map((order) => ({
    id: order.id,
    queueNumber: order.queueNumber,
    channel: order.channel,
    tableLabel: order.tableLabel,
    createdAt: order.createdAt.toISOString(),
    status: order.status as "OPEN" | "PAID",
    totalQty: order.items.reduce((sum, i) => sum + i.qty, 0),
    portionsToCook: order.items.reduce((sum, i) => sum + (i.isKitchenItem ? i.qty : 0), 0),
    items: order.items.map((i) => ({ productName: i.productName, qty: i.qty })),
  }));
}

export type UnpaidServedOrder = {
  id: string;
  queueNumber: number;
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  servedAt: string;
};

// Food already served but not yet paid (typical dine-in: eat now, pay
// later) has nowhere else to surface once it drops off the main Order
// Aktif list — this is how "Pembayaran dibuka dari Order Aktif" stays true
// for that case instead of the order becoming unreachable.
export async function getUnpaidServedOrders(): Promise<UnpaidServedOrder[]> {
  const orders = await prisma.order.findMany({
    where: { servedAt: { not: null }, status: "OPEN" },
    orderBy: { servedAt: "asc" },
  });

  return orders.map((order) => ({
    id: order.id,
    queueNumber: order.queueNumber,
    channel: order.channel,
    tableLabel: order.tableLabel,
    servedAt: order.servedAt!.toISOString(),
  }));
}
