// Matches ComboCache.items' JSON shape (see schema.prisma). Identity only —
// productId + addonOptionIds, no prices — so the UI always resolves the
// actual price live from the current menu tree instead of trusting a cache
// that's at most a day stale. See get-combo-shortcuts.ts.
export type ComboShortcutItem = {
  productId: string;
  name: string;
  qty: number;
  addons: { addonOptionId: string; name: string; qty: number }[];
};

export type ComboShortcut = {
  comboKey: string;
  displayName: string;
  totalPrice: number;
  salesCount30d: number;
  items: ComboShortcutItem[];
};
