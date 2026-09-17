import type { ReceiptAddon, ReceiptItem } from "./types";

function addonSignature(addons: ReceiptAddon[]): string {
  return addons
    .map((a) => `${a.name}:${a.price}`)
    .sort()
    .join("|");
}

// "Item dengan nama dan add-on identik digabung jadi satu baris dengan qty."
// Two cart lines only merge when product name, notes, and the exact addon
// set all match — a note like "gak pake sawi" on one line must not silently
// merge with an identical order missing that note.
export function mergeReceiptItems(items: ReceiptItem[]): ReceiptItem[] {
  const merged = new Map<string, ReceiptItem>();

  for (const item of items) {
    const key = [item.productName, item.notes ?? "", addonSignature(item.addons)].join("::");
    const existing = merged.get(key);
    if (existing) {
      existing.qty += item.qty;
      existing.lineTotal += item.lineTotal;
    } else {
      merged.set(key, { ...item, addons: [...item.addons] });
    }
  }

  return [...merged.values()];
}

// Total portion count across the (already-merged) item list — printed as
// "5 item" above Subtotal so staff can sanity-check a bulk order is
// complete at a glance. Sum of qty, not distinct product lines: "2x Mie
// Ayam, 1x Es Teh" should read as 3 item, matching what's physically being
// handed over.
export function totalItemCount(items: { qty: number }[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}Rp${Math.abs(amount).toLocaleString("id-ID")}`;
}

// Groups a flat addon list (one row per selected unit — an addon option
// picked with qty 2 appears as two identical {name, price} entries, see
// CartAddon.qty / expandAddonOptionIds) back into one entry per distinct
// option with a qty count, so it can be printed as "Ceker x2" instead of
// two separate "Ceker" lines.
export function groupAddonsForPrint<T extends { name: string; price: number }>(
  addons: T[],
): (T & { qty: number })[] {
  const grouped: (T & { qty: number })[] = [];
  const indexByKey = new Map<string, number>();
  for (const addon of addons) {
    const key = `${addon.name}::${addon.price}`;
    const existingIndex = indexByKey.get(key);
    if (existingIndex != null) {
      grouped[existingIndex].qty += 1;
    } else {
      indexByKey.set(key, grouped.length);
      grouped.push({ ...addon, qty: 1 });
    }
  }
  return grouped;
}

export function formatAddonWithQty(addon: { name: string; qty: number }): string {
  return addon.qty > 1 ? `${addon.name} x${addon.qty}` : addon.name;
}
