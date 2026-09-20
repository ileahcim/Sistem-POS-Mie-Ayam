import { prisma } from "@/lib/prisma";
import { formatId } from "@/lib/timezone";

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

export type PreOrderReminder = {
  id: string;
  // Already formatted in Asia/Jakarta on the server (see CLAUDE.md "Zona
  // waktu"): the tablet's own clock must never decide what "jam 18.30"
  // means, and the client component only ever prints this string.
  timeLabel: string;
  // True once the delivery time is today, so the bar can say "hari ini"
  // instead of repeating the date for the common case.
  isToday: boolean;
  dateLabel: string;
};

// Pre-orders whose delivery time falls inside the next `minutesAhead`
// minutes — what the red bar on the Kasir screen counts. Same cutoff style
// as getUpcomingPreOrders: anything already past scheduledFor has moved to
// Order Aktif on its own, so the window starts at "now" and never looks
// back. PAID pre-orders still need cooking and delivering, so they count
// too; only cancelled/void ones drop out.
export async function getPreOrderReminders(minutesAhead: number): Promise<PreOrderReminder[]> {
  const now = new Date();
  const until = new Date(now.getTime() + minutesAhead * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      scheduledFor: { gt: now, lte: until },
      status: { in: ["OPEN", "PAID"] },
    },
    orderBy: { scheduledFor: "asc" },
    select: { id: true, scheduledFor: true },
  });

  const today = formatId(now, { day: "numeric", month: "short" });
  return orders.map((order) => {
    const when = order.scheduledFor!;
    const dateLabel = formatId(when, { day: "numeric", month: "short" });
    return {
      id: order.id,
      timeLabel: formatId(when, { hour: "2-digit", minute: "2-digit", hour12: false }),
      isToday: dateLabel === today,
      dateLabel,
    };
  });
}
