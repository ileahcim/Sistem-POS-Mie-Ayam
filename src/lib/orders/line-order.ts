// Reading order for a list of order lines — the cart, the saved order, and
// the payment screen. Lines used to sit in the order they were tapped, so a
// cart read "Mie Ayam, Bakso, Mie Ayam" and the cashier had to scan the whole
// list to check one product.
//
// Category first, in exactly the order the Kasir tabs use (Category.sortOrder
// straight from the DB — Makanan, Minuman Racik, Kulkas, Lain-lain, Frozen —
// so adding or reordering a category moves the cart with it and nothing here
// needs editing), then product name so identical products always end up
// adjacent. No group headings and no separators: the owner asked for the
// order only, and a divider in a cart this short costs more than it gives.
//
// NOT used for the receipt. Printed items stay in the order they were added
// (buildReceiptData reads getOrderDetail untouched) — the paper is the record
// of the transaction, and it was explicitly left alone.

export type OrderedLine = { categorySortOrder: number; productName: string };

export function compareOrderLines(a: OrderedLine, b: OrderedLine): number {
  if (a.categorySortOrder !== b.categorySortOrder) return a.categorySortOrder - b.categorySortOrder;
  return a.productName.localeCompare(b.productName, "id");
}

// Array.sort is stable, so two lines of the same product (different add-ons)
// keep the order they were added in — they just sit next to each other now.
export function sortOrderLines<T extends OrderedLine>(lines: readonly T[]): T[] {
  return [...lines].sort(compareOrderLines);
}

// A running portion count is only worth screen space once the cart is past
// what you can count at a glance. Below this it is noise on every single
// one-bowl order, which is most of them.
export const PORTION_COUNT_VISIBLE_FROM = 6;
