import { prisma } from "@/lib/prisma";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "./pricing";

export type ReceivableOrder = {
  id: string;
  queueNumber: number;
  customerName: string | null;
  createdAt: string;
  total: number;
};

export async function getReceivableOrders(): Promise<ReceivableOrder[]> {
  const orders = await prisma.order.findMany({
    where: { status: "RECEIVABLE" },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  return orders.map((order) => {
    const subtotal = order.items.reduce((sum, i) => sum + i.lineTotal, 0);
    const deliveryFee =
      order.channel === "ANTAR"
        ? order.items.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) * DELIVERY_FEE_PER_FOOD_ITEM
        : 0;
    return {
      id: order.id,
      queueNumber: order.queueNumber,
      customerName: order.customerName,
      createdAt: order.createdAt.toISOString(),
      total: subtotal + deliveryFee,
    };
  });
}
