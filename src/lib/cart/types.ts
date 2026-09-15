export type ChannelType = "DINE_IN" | "BUNGKUS" | "ANTAR";
export const TABLE_LABELS = ["K1", "K2", "L1", "L2", "L3"] as const;
export type TableLabel = (typeof TABLE_LABELS)[number];

export type CartAddon = {
  addonOptionId: string;
  name: string;
  price: number;
};

// One cart line. `localId` is a client-only key (stable across re-renders,
// used to find-and-replace a line when editing) — it's never sent to the
// server; the server assigns real OrderItem ids on save.
export type CartItem = {
  localId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  addons: CartAddon[];
  notes: string;
  qty: number;
  isDeliveryChargeable: boolean; // snapshot of "is this product's category Makanan"
};

export type CartDraft = {
  channel: ChannelType | null;
  tableLabel: TableLabel | null;
  customerName: string; // optional — a name to call out or write on packaging
  items: CartItem[];
};

export function emptyCartDraft(): CartDraft {
  return { channel: null, tableLabel: null, customerName: "", items: [] };
}

export function createLocalId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function cartItemUnitTotal(item: Pick<CartItem, "unitPrice" | "addons">): number {
  return item.unitPrice + item.addons.reduce((sum, a) => sum + a.price, 0);
}

export function cartItemLineTotal(item: Pick<CartItem, "unitPrice" | "addons" | "qty">): number {
  return cartItemUnitTotal(item) * item.qty;
}

// Same product + exact same add-on selection + no notes -> a repeat tap
// should bump qty on the existing line instead of creating a duplicate one.
// Order-independent on addons (a cart line's addon array order isn't
// meaningful). Used for both plain-product re-taps and combo shortcut taps.
export function sameCartLine(
  a: Pick<CartItem, "productId" | "addons" | "notes">,
  b: Pick<CartItem, "productId" | "addons" | "notes">,
): boolean {
  if (a.productId !== b.productId) return false;
  if (a.notes || b.notes) return false;
  if (a.addons.length !== b.addons.length) return false;
  const aIds = [...a.addons.map((x) => x.addonOptionId)].sort();
  const bIds = [...b.addons.map((x) => x.addonOptionId)].sort();
  return aIds.every((id, i) => id === bIds[i]);
}
