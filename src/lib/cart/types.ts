export type ChannelType = "DINE_IN" | "BUNGKUS" | "ANTAR";
export const TABLE_LABELS = ["K1", "K2", "L1", "L2", "L3"] as const;
export type TableLabel = (typeof TABLE_LABELS)[number];

export type CartAddon = {
  addonOptionId: string;
  name: string;
  price: number;
  // How many of this addon option — a multi-select group ("boleh pilih
  // banyak") uses a qty stepper instead of a checkbox (e.g. Ceker x2), a
  // single-select group (radio) always has qty 1. Server-side there's no
  // separate qty column — see expandAddonOptionIds below.
  qty: number;
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
  // Category.sortOrder, snapshotted so the cart can be sorted into reading
  // order without looking the product back up — see lib/orders/line-order.ts.
  categorySortOrder: number;
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
  return item.unitPrice + item.addons.reduce((sum, a) => sum + a.price * a.qty, 0);
}

// Flattens {addonOptionId, qty}[] into one repeated id per unit — e.g. Ceker
// with qty 2 becomes ["ceker-id", "ceker-id"] — because the server side
// (buildOrderItemsCreateData / OrderItemAddon) has no qty column: it just
// creates one snapshot row per array entry. Two rows of "Ceker" IS qty 2,
// with no schema change needed and every existing DB-reading aggregate
// (top-addon-terlaris, margin) counting it correctly for free. Only the
// receipt/packing-list *display* needs to re-group rows back into "Ceker x2"
// — see groupAddonsForPrint in src/lib/printing/format.ts.
export function expandAddonOptionIds(addons: Pick<CartAddon, "addonOptionId" | "qty">[]): string[] {
  return addons.flatMap((a) => Array(a.qty).fill(a.addonOptionId) as string[]);
}

export function cartItemLineTotal(item: Pick<CartItem, "unitPrice" | "addons" | "qty">): number {
  return cartItemUnitTotal(item) * item.qty;
}

// THE merge rule, one definition for every screen: two lines are the same
// line when the product, the exact add-on selection (option AND its qty),
// and the note all match. Order-independent on addons (a cart line's addon
// array order isn't meaningful) and whitespace-independent on the note, so
// a note typed with a trailing space still merges.
//
// Notes used to abort the comparison outright (`if (a.notes || b.notes)
// return false`), which meant two lines carrying the SAME note never merged
// — "2x Mie Ayam pedas" came out as two rows of one.
export function sameCartLine(
  a: Pick<CartItem, "productId" | "addons" | "notes">,
  b: Pick<CartItem, "productId" | "addons" | "notes">,
): boolean {
  if (a.productId !== b.productId) return false;
  if ((a.notes ?? "").trim() !== (b.notes ?? "").trim()) return false;
  if (a.addons.length !== b.addons.length) return false;
  const aIds = [...a.addons.map((x) => `${x.addonOptionId}:${x.qty}`)].sort();
  const bIds = [...b.addons.map((x) => `${x.addonOptionId}:${x.qty}`)].sort();
  return aIds.every((id, i) => id === bIds[i]);
}

// Puts a line into a cart: folds it into the identical line already there,
// or appends it. `replacingLocalId` is the line currently being edited — it
// is lifted out BEFORE the lookup, which is the part that used to be
// missing: editing one line until it matched another left two identical
// rows behind, because an edit only ever wrote back in place.
//
// Returns the localId the quantity landed on, so the caller can flash the
// right row. Used by the draft hook and by the "+ Tambah Item" panel, which
// keeps their behaviour identical by construction.
export function upsertCartLine(
  items: CartItem[],
  raw: Omit<CartItem, "localId">,
  replacingLocalId: string | null = null,
): { items: CartItem[]; localId: string } {
  // Trim once, here, so the note that gets STORED matches the note that was
  // compared — otherwise merging "pedas" with "pedas " kept the stray space
  // and printed it on the struk.
  const incoming = { ...raw, notes: (raw.notes ?? "").trim() };
  const others = replacingLocalId ? items.filter((i) => i.localId !== replacingLocalId) : items;

  const twin = others.find((i) => sameCartLine(i, incoming));
  if (twin) {
    return {
      items: others.map((i) =>
        i.localId === twin.localId ? { ...incoming, localId: twin.localId, qty: i.qty + incoming.qty } : i,
      ),
      localId: twin.localId,
    };
  }

  if (replacingLocalId) {
    // Edited but still one of a kind: keep it where it was so the row
    // doesn't jump out from under the finger that just edited it.
    return {
      items: items.map((i) => (i.localId === replacingLocalId ? { ...incoming, localId: replacingLocalId } : i)),
      localId: replacingLocalId,
    };
  }

  const localId = createLocalId();
  return { items: [...items, { ...incoming, localId }], localId };
}
