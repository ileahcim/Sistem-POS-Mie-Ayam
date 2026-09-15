import { prisma } from "@/lib/prisma";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "@/lib/orders/pricing";
import { DASHBOARD_WINDOW_DAYS } from "./config";

export type ChannelBreakdownRow = {
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  orderCount: number;
  omzet: number;
};

const ALL_CHANNELS: ChannelBreakdownRow["channel"][] = ["DINE_IN", "BUNGKUS", "ANTAR"];

// PAID orders only (VOID/RECEIVABLE never count as sales), same rolling
// window as the rest of the item-level dashboard sections.
export async function getChannelBreakdown(): Promise<ChannelBreakdownRow[]> {
  const since = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { status: "PAID", paidAt: { gte: since } },
    include: { items: true },
  });

  const byChannel = new Map<string, ChannelBreakdownRow>(ALL_CHANNELS.map((c) => [c, { channel: c, orderCount: 0, omzet: 0 }]));

  for (const order of orders) {
    const subtotal = order.items.reduce((sum, i) => sum + i.lineTotal, 0);
    const deliveryFee =
      order.channel === "ANTAR"
        ? order.items.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) * DELIVERY_FEE_PER_FOOD_ITEM
        : 0;
    const row = byChannel.get(order.channel)!;
    row.orderCount += 1;
    row.omzet += subtotal + deliveryFee;
  }

  return ALL_CHANNELS.map((c) => byChannel.get(c)!);
}
