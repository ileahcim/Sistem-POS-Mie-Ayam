import { prisma } from "@/lib/prisma";
import { DELIVERY_CHARGEABLE_CATEGORY_NAME } from "@/lib/menu/get-active-menu";

export type ActiveOrderItem = {
  id: string;
  productName: string;
  qty: number;
  unitPrice: number;
  addons: { name: string; price: number }[];
  notes: string | null;
  // Same reading-order keys as OrderDetailItem (line-order.ts's
  // sortOrderLines) — a custom item falls back to the Makanan category's
  // sortOrder, same trick as get-order-detail.ts, so it doesn't jump to the
  // very front of the list under the default 0 fallback.
  categorySortOrder: number;
  productSortOrder: number;
};

export type ActiveOrder = {
  id: string;
  queueNumber: number | null; // null: a due pre-order not yet paid — see CLAUDE.md "Pre-order"
  queueSuffix: string; // "" normally, "A"/"B"/... for a Pisahkan & Bayar child — see queue-label.ts
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  createdAt: string; // ISO — serializable across the server/client boundary
  status: "OPEN" | "PAID";
  totalQty: number;
  portionsToCook: number; // qty summed over Makanan/Minuman Racik lines only
  items: ActiveOrderItem[];
  // True once a DP was taken. Such an order can't be cancelled with the plain
  // "Batal" button (the DP needs a decision) — the row hides it.
  hasDeposit: boolean;
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
    include: {
      items: {
        include: {
          addons: { select: { name: true, price: true } },
          product: { select: { sortOrder: true, category: { select: { sortOrder: true } } } },
        },
      },
      deposits: { select: { id: true }, take: 1 },
    },
  });

  // Only fetched when some active order actually has a custom item (product
  // relation null) — a live lookup, never hardcoded, same as
  // get-order-detail.ts / build-order-items.ts.
  const hasCustomItem = orders.some((o) => o.items.some((i) => !i.product));
  const makananCategory = hasCustomItem
    ? await prisma.category.findUnique({ where: { name: DELIVERY_CHARGEABLE_CATEGORY_NAME } })
    : null;

  return orders.map((order) => ({
    id: order.id,
    queueNumber: order.queueNumber,
    queueSuffix: order.queueSuffix,
    channel: order.channel,
    tableLabel: order.tableLabel,
    createdAt: order.createdAt.toISOString(),
    status: order.status as "OPEN" | "PAID",
    totalQty: order.items.reduce((sum, i) => sum + i.qty, 0),
    portionsToCook: order.items.reduce((sum, i) => sum + (i.isKitchenItem ? i.qty : 0), 0),
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      qty: i.qty,
      unitPrice: i.unitPrice,
      addons: i.addons,
      notes: i.notes,
      categorySortOrder: i.product ? i.product.category.sortOrder : (makananCategory?.sortOrder ?? 0),
      productSortOrder: i.product ? i.product.sortOrder : Number.MAX_SAFE_INTEGER,
    })),
    hasDeposit: order.deposits.length > 0,
  }));
}

export type UnpaidServedOrder = {
  id: string;
  queueNumber: number | null;
  queueSuffix: string;
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  servedAt: string;
  hasDeposit: boolean;
};

// Food already served but not yet paid (typical dine-in: eat now, pay
// later) has nowhere else to surface once it drops off the main Order
// Aktif list — this is how "Pembayaran dibuka dari Order Aktif" stays true
// for that case instead of the order becoming unreachable.
export async function getUnpaidServedOrders(): Promise<UnpaidServedOrder[]> {
  const orders = await prisma.order.findMany({
    where: { servedAt: { not: null }, status: "OPEN" },
    orderBy: { servedAt: "asc" },
    include: { deposits: { select: { id: true }, take: 1 } },
  });

  return orders.map((order) => ({
    id: order.id,
    queueNumber: order.queueNumber,
    queueSuffix: order.queueSuffix,
    channel: order.channel,
    tableLabel: order.tableLabel,
    servedAt: order.servedAt!.toISOString(),
    hasDeposit: order.deposits.length > 0,
  }));
}
