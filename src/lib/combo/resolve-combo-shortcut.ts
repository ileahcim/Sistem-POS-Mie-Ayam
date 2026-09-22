import type { MenuCategory } from "@/lib/menu/get-active-menu";
import type { CartItem } from "@/lib/cart/types";
import type { ComboShortcut } from "./types";

// Resolves a cached shortcut's identity (productId + addonOptionIds) against
// the *live* menu tree already loaded for the screen — never against the
// shortcut's own cached totalPrice, which can be up to a day stale (see
// refresh-combo-cache.ts). Returns null if the product or any add-on
// referenced by the shortcut has since been deactivated, so a stale card
// can never add a dead-end line to the cart; the shortcut list itself
// self-heals at the next daily refresh.
export function resolveComboShortcut(
  shortcut: ComboShortcut,
  categories: MenuCategory[],
): Omit<CartItem, "localId"> | null {
  const item = shortcut.items[0];
  if (!item) return null;

  const product = categories.flatMap((c) => c.products).find((p) => p.id === item.productId);
  if (!product) return null;

  const allOptions = product.addonGroups.flatMap((g) => g.options);
  const addons = [];
  for (const a of item.addons) {
    const option = allOptions.find((o) => o.id === a.addonOptionId);
    if (!option) return null;
    // `a.qty` can be missing on a ComboCache row written before qty existed
    // on this shape (ComboCache.items is untyped JSON in Postgres — an old
    // row persists as-is until the next daily refresh, see
    // refresh-combo-cache.ts) — default to 1 rather than let it become NaN.
    addons.push({ addonOptionId: option.id, name: option.name, price: option.price, qty: a.qty ?? 1 });
  }

  return {
    productId: product.id,
    productName: product.name,
    isCustom: false,
    unitPrice: product.price,
    addons,
    notes: "",
    qty: 1,
    isDeliveryChargeable: product.isDeliveryChargeable,
    categorySortOrder: product.categorySortOrder,
        productSortOrder: product.productSortOrder,
  };
}
