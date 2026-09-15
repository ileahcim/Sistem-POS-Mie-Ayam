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

export function formatRupiah(amount: number): string {
  return amount.toLocaleString("id-ID");
}
