import { prisma } from "@/lib/prisma";
import { localDateStr, formatId } from "@/lib/timezone";
import { ICE_CREAM_CATEGORY_NAME, type SelfUseRow, type StockKind } from "./types";

export type IceCreamProduct = {
  id: string;
  name: string;
  price: number;
  costPrice: number | null; // modal per pcs = boxPrice ÷ unitsPerBox at the latest Barang Masuk
  unitsPerBox: number | null;
  boxPrice: number | null;
  stock: number;
  isActive: boolean;
  imageUrl: string | null;
};

// Every product that tracks stock, active first (grid order), then inactive —
// "nonaktifkan" needs to see what's already off to turn it back on, and an
// inactive product can still hold stock (e.g. a correction to zero it out).
export async function getIceCreamProducts(): Promise<IceCreamProduct[]> {
  const rows = await prisma.product.findMany({
    where: { tracksStock: true },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      price: true,
      costPrice: true,
      unitsPerBox: true,
      boxPrice: true,
      stock: true,
      isActive: true,
      imageUrl: true,
    },
  });
  return rows;
}

export async function getIceCreamCategoryId(): Promise<string | null> {
  const category = await prisma.category.findUnique({ where: { name: ICE_CREAM_CATEGORY_NAME }, select: { id: true } });
  return category?.id ?? null;
}

export type StockHistoryRow = {
  id: string;
  kind: StockKind;
  qtyChange: number;
  stockAfter: number;
  boxes: number | null;
  unitsPerBox: number | null;
  boxPrice: number | null;
  unitCost: number | null;
  takenBy: string | null;
  note: string | null;
  orderLabel: string | null; // "Order #12" / "No. 1834" for SALE / SALE_RETURN
  orderId: string | null;
  userName: string;
  dateLabel: string; // "Sab, 31 Okt 2026 · 12.00" (WIB)
};

// Newest first. Bounded so a busy product's page stays light; the full
// trail always remains in the table.
export async function getStockHistory(productId: string, limit = 300): Promise<StockHistoryRow[]> {
  const rows = await prisma.stockMovement.findMany({
    where: { productId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: {
      createdBy: { select: { name: true } },
      order: { select: { orderNumber: true, queueNumber: true, queueSuffix: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    qtyChange: r.qtyChange,
    stockAfter: r.stockAfter,
    boxes: r.boxes,
    unitsPerBox: r.unitsPerBox,
    boxPrice: r.boxPrice,
    unitCost: r.unitCost,
    takenBy: r.takenBy,
    note: r.note,
    orderId: r.orderId,
    orderLabel: r.order
      ? r.order.queueNumber != null
        ? `Order #${r.order.queueNumber}${r.order.queueSuffix ? `-${r.order.queueSuffix}` : ""} · No. ${r.order.orderNumber}`
        : `Pre-order No. ${r.order.orderNumber}`
      : null,
    userName: r.createdBy.name,
    dateLabel: formatId(r.createdAt, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  }));
}

// "Ambil Sendiri" rows for the Dashboard summary — all of them (a family's
// ice cream is a handful of rows a week), filtered client-side by the same
// date range as the other sales sections. Valued at the unitCost snapshot
// taken when the pcs left the freezer.

export async function getSelfUseRows(): Promise<SelfUseRow[]> {
  const rows = await prisma.stockMovement.findMany({
    where: { kind: "SELF_USE" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, qtyChange: true, unitCost: true, product: { select: { name: true } } },
  });
  return rows.map((r) => {
    const qty = -r.qtyChange;
    return {
      date: localDateStr(r.createdAt),
      productName: r.product.name,
      qty,
      value: (r.unitCost ?? 0) * qty,
      hasCost: r.unitCost != null,
    };
  });
}
