// Reading order for a list of order lines — the cart, the saved order, the
// payment screen, AND the printed paper (struk, bukti DP, daftar packing).
// One comparator for all of them, so screen and paper can never disagree.
//
//   1. Category.sortOrder — Makanan, Minuman Racik, Kulkas, Lain-lain, Frozen,
//      exactly the Kasir tabs (read straight from the DB, so reordering the
//      categories moves every list with it and nothing here needs editing).
//   2. Product.sortOrder — the order of the Kasir product grid, so every Mie
//      Ayam line comes before every Bakso line. (It used to be the product
//      NAME, which put Bakso above Mie Ayam.)
//   3. Price per portion, cheapest first — plain Mie Ayam, then + Bakso,
//      then + Bakso Urat, ...
//
// Array.sort is stable, so lines that tie on all three keep the order they
// were added in. A line without sort keys (an old cart draft, the test print)
// counts as 0 and keeps its place rather than failing.

export type OrderedLine = {
  categorySortOrder?: number;
  productSortOrder?: number;
  productName: string;
};

// Price of ONE portion of a line: base price plus its add-ons. A cart add-on
// carries its own qty; an OrderItemAddon / receipt add-on is one row per unit
// (see expandAddonOptionIds), so a missing qty means 1.
export function portionPriceOf(line: { unitPrice: number; addons: readonly { price: number; qty?: number }[] }): number {
  return line.unitPrice + line.addons.reduce((sum, a) => sum + a.price * (a.qty ?? 1), 0);
}

export function sortOrderLines<T extends OrderedLine>(lines: readonly T[], portionPrice: (line: T) => number): T[] {
  return [...lines].sort(
    (a, b) =>
      (a.categorySortOrder ?? 0) - (b.categorySortOrder ?? 0) ||
      (a.productSortOrder ?? 0) - (b.productSortOrder ?? 0) ||
      // Two products sharing a sortOrder still must not interleave.
      a.productName.localeCompare(b.productName, "id") ||
      portionPrice(a) - portionPrice(b),
  );
}

// Per-product grouping on screen (never on paper) — so the cashier can check
// "how many Mie Ayam?" on a big order without counting. Only from this many
// portions: below it the list is short enough to hold in your head, and the
// dividers would just be clutter on every one-bowl order.
//
// Deliberately NOT the "Borongan" badge threshold (>10, Order Aktif): that
// badge changes how the prep timer treats an order, and lowering it to 5
// would take the lateness warning away from ordinary family orders.
export const GROUPING_VISIBLE_FROM = 5;

export type GroupableLine = {
  productId: string;
  productName: string;
  qty: number;
  // Snapshot of "this product's category is Makanan" — the same flag ongkir
  // uses. Food is grouped per product with a count; everything else is one
  // block with no counts (few variants, nothing to add up).
  isDeliveryChargeable: boolean;
};

export type LineListEntry<T> =
  | { kind: "line"; line: T }
  | { kind: "groupTotal"; key: string; productName: string; portions: number }
  | { kind: "separator"; key: string };

export type LineListLayout<T> = {
  entries: LineListEntry<T>[];
  portions: number;
  // true when the per-product dividers and the "Total: N item" line show.
  grouped: boolean;
};

// Takes lines ALREADY in reading order (sortOrderLines) and decides what goes
// between them:
//   - each food product is its own block, closed by "<name>: N porsi" when
//     the block has more than one line (a single line already says its qty);
//   - all non-food lines together form one block, without counts;
//   - a dashed separator between consecutive blocks.
export function layoutOrderLines<T extends GroupableLine>(sortedLines: readonly T[]): LineListLayout<T> {
  const portions = sortedLines.reduce((sum, l) => sum + l.qty, 0);
  if (portions < GROUPING_VISIBLE_FROM) {
    return { entries: sortedLines.map((line) => ({ kind: "line", line })), portions, grouped: false };
  }

  const blocks: T[][] = [];
  const blockKey = (l: T) => (l.isDeliveryChargeable ? `food:${l.productId}` : "other");
  for (const line of sortedLines) {
    const last = blocks[blocks.length - 1];
    if (last && blockKey(last[0]) === blockKey(line)) last.push(line);
    else blocks.push([line]);
  }

  const entries: LineListEntry<T>[] = [];
  blocks.forEach((block, i) => {
    if (i > 0) entries.push({ kind: "separator", key: `sep-${i}` });
    for (const line of block) entries.push({ kind: "line", line });
    const head = block[0];
    if (head.isDeliveryChargeable && block.length > 1) {
      entries.push({
        kind: "groupTotal",
        key: `total-${i}`,
        productName: head.productName,
        portions: block.reduce((sum, l) => sum + l.qty, 0),
      });
    }
  });
  return { entries, portions, grouped: true };
}
