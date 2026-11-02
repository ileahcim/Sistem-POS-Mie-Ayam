// Es Krim stock — shared constants/labels (docs/spec-es-krim.md). Neutral
// file on purpose: no Prisma import, so client components may value-import it
// (CLAUDE.md "Batas client/server").

// The Kasir tab and the Stok Es Krim page find their products by this exact
// category name — same established pattern as DELIVERY_CHARGEABLE_CATEGORY_NAME.
// Stock logic itself keys off Product.tracksStock, never the name.
export const ICE_CREAM_CATEGORY_NAME = "Es Krim";

// At or below this the Kasir card shows a small "sisa X" badge.
export const LOW_STOCK_THRESHOLD = 5;

export type StockKind = "RESTOCK" | "SALE" | "SALE_RETURN" | "CORRECTION" | "SELF_USE";

export const STOCK_KIND_LABEL: Record<StockKind, string> = {
  RESTOCK: "Barang Masuk",
  SALE: "Terjual",
  SALE_RETURN: "Batal/Void",
  CORRECTION: "Koreksi",
  SELF_USE: "Ambil Sendiri",
};

// Quick-pick reasons on the Koreksi Stok form (free text stays possible).
export const CORRECTION_REASONS = ["Rusak", "Meleleh", "Salah hitung", "Hilang"] as const;

// Modal per pcs from the latest box purchase. Rounded to whole rupiah (all
// seven launch products divide exactly).
export function unitCostFromBox(boxPrice: number, unitsPerBox: number): number {
  return Math.round(boxPrice / unitsPerBox);
}

// Pcs still tappable on a Kasir card: live stock minus what is already in
// the cart/pending list on this screen. null = product doesn't track stock.
export function remainingStock(stock: number | null, inCart: number): number | null {
  return stock == null ? null : Math.max(0, stock - inCart);
}

// productId → live stock, for the products that track it (es krim). Feeds
// the cart steppers so [+] stops at what is actually in the freezer.
export function stockByProductOf(products: { id: string; stock: number | null }[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of products) if (p.stock != null) map[p.id] = p.stock;
  return map;
}

// True when every pcs of this product is already in the list on screen.
export function atStockLimit(
  productId: string,
  stockByProduct: Record<string, number> | undefined,
  qtyByProduct: Record<string, number>,
): boolean {
  const stock = stockByProduct?.[productId];
  return stock != null && (qtyByProduct[productId] ?? 0) >= stock;
}

// One "Ambil Sendiri" row for the Dashboard: WIB day, pcs, and its value at
// the modal-per-pcs snapshot taken when it left the freezer.
export type SelfUseRow = { date: string; productName: string; qty: number; value: number; hasCost: boolean };

export type SelfUseSummary = {
  qty: number;
  value: number;
  missingCost: boolean;
  byProduct: { name: string; qty: number; value: number }[];
};

// Pure — filtered client-side by the Dashboard's shared date range (same
// "YYYY-MM-DD" string compare as filterOrdersByRange).
export function summarizeSelfUse(rows: SelfUseRow[], range: { from: string; to: string }): SelfUseSummary {
  const byName = new Map<string, { name: string; qty: number; value: number }>();
  let qty = 0;
  let value = 0;
  let missingCost = false;
  for (const r of rows) {
    if (r.date < range.from || r.date > range.to) continue;
    qty += r.qty;
    value += r.value;
    if (!r.hasCost) missingCost = true;
    const entry = byName.get(r.productName) ?? { name: r.productName, qty: 0, value: 0 };
    entry.qty += r.qty;
    entry.value += r.value;
    byName.set(r.productName, entry);
  }
  return { qty, value, missingCost, byProduct: [...byName.values()].sort((a, b) => b.qty - a.qty) };
}
