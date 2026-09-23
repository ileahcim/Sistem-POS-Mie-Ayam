import { prisma } from "@/lib/prisma";
import { localDateParts, wibDateRange, formatId } from "@/lib/timezone";

export type TomorrowRecapProductTotal = { productName: string; qty: number };
export type TomorrowRecapOrder = { id: string; timeLabel: string; customerName: string | null };

export type TomorrowPreorderRecap = {
  products: TomorrowRecapProductTotal[];
  orders: TomorrowRecapOrder[];
};

// Tomorrow's Jakarta calendar date as "YYYY-MM-DD" — same day-math-scratchpad
// trick as timezone.ts's mondayOfLocalWeek (plain UTC-Date arithmetic used
// only to add a day to an already-correct local Y/M/D triple, never to read
// back a real instant).
function tomorrowDateStr(now: Date): string {
  const p = localDateParts(now);
  const scratch = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${scratch.getUTCFullYear()}-${pad2(scratch.getUTCMonth() + 1)}-${pad2(scratch.getUTCDate())}`;
}

// "Rekap Pre-order Besok" — top of Pesanan Terjadwal (CLAUDE.md, 24 Sep
// 2026): total portions per product across every pre-order due tomorrow,
// grouped by name like the cart's per-product subtotal, plus the plain list
// of delivery times + orderer names so the kitchen can plan ahead. null when
// there is nothing due tomorrow — the section doesn't render at all then.
export async function getTomorrowPreorderRecap(): Promise<TomorrowPreorderRecap | null> {
  const now = new Date();
  const { start, end } = wibDateRange(tomorrowDateStr(now));

  const orders = await prisma.order.findMany({
    where: { scheduledFor: { gte: start, lt: end }, status: { in: ["OPEN", "PAID"] } },
    orderBy: { scheduledFor: "asc" },
    include: {
      items: {
        select: {
          productName: true,
          qty: true,
          product: { select: { sortOrder: true, category: { select: { sortOrder: true } } } },
        },
      },
    },
  });

  if (orders.length === 0) return null;

  type Group = { productName: string; qty: number; categorySortOrder: number; productSortOrder: number };
  const groups = new Map<string, Group>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = groups.get(item.productName);
      if (existing) {
        existing.qty += item.qty;
      } else {
        groups.set(item.productName, {
          productName: item.productName,
          qty: item.qty,
          categorySortOrder: item.product ? item.product.category.sortOrder : Number.MAX_SAFE_INTEGER,
          productSortOrder: item.product ? item.product.sortOrder : Number.MAX_SAFE_INTEGER,
        });
      }
    }
  }

  const products = [...groups.values()]
    .sort(
      (a, b) =>
        a.categorySortOrder - b.categorySortOrder ||
        a.productSortOrder - b.productSortOrder ||
        a.productName.localeCompare(b.productName, "id"),
    )
    .map((g) => ({ productName: g.productName, qty: g.qty }));

  return {
    products,
    orders: orders.map((order) => ({
      id: order.id,
      timeLabel: formatId(order.scheduledFor!, { hour: "2-digit", minute: "2-digit", hour12: false }),
      customerName: order.customerName,
    })),
  };
}
