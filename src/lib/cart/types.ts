export type ChannelType = "DINE_IN" | "BUNGKUS" | "ANTAR";
export const CHANNELS: readonly ChannelType[] = ["DINE_IN", "BUNGKUS", "ANTAR"];
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
  // For a real menu item, the actual Product id. For a custom item
  // ("+ Item Custom" — CLAUDE.md-worthy brief, 22 Sep 2026), a SYNTHETIC
  // per-name grouping key (`custom:<name>`, see customGroupingKey below) —
  // there's no real Product row, but sameCartLine/line-order.ts still need
  // some string to tell two different lines apart.
  productId: string;
  productName: string;
  isCustom: boolean;
  unitPrice: number;
  addons: CartAddon[];
  notes: string;
  qty: number;
  isDeliveryChargeable: boolean; // snapshot of "is this product's category Makanan"
  // Category.sortOrder and Product.sortOrder, snapshotted so the cart can be
  // sorted into reading order without looking the product back up — see
  // lib/orders/line-order.ts.
  categorySortOrder: number;
  productSortOrder: number;
};

export function customGroupingKey(name: string): string {
  return `custom:${name}`;
}

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

// The inverse of expandAddonOptionIds — groups the one-row-per-unit shape
// OrderItemAddon comes back as (via getOrderDetail) into {addonOptionId,
// qty} pairs AddonSheet's `initial` prop expects. Used to pre-fill the sheet
// when editing an item already on a saved order (order-detail.tsx).
export function groupOrderItemAddons(addons: { addonOptionId: string; name: string; price: number }[]): CartAddon[] {
  const byOption = new Map<string, CartAddon>();
  for (const a of addons) {
    const existing = byOption.get(a.addonOptionId);
    if (existing) existing.qty += 1;
    else byOption.set(a.addonOptionId, { addonOptionId: a.addonOptionId, name: a.name, price: a.price, qty: 1 });
  }
  return [...byOption.values()];
}

export function cartItemLineTotal(item: Pick<CartItem, "unitPrice" | "addons" | "qty">): number {
  return cartItemUnitTotal(item) * item.qty;
}

// THE merge rule, one definition for every screen: two lines are the same
// line when the product, the exact add-on selection (option AND its qty),
// the note, AND the unit price all match. Order-independent on addons (a
// cart line's addon array order isn't meaningful) and whitespace-independent
// on the note, so a note typed with a trailing space still merges.
//
// Notes used to abort the comparison outright (`if (a.notes || b.notes)
// return false`), which meant two lines carrying the SAME note never merged
// — "2x Mie Ayam pedas" came out as two rows of one.
//
// unitPrice joined the comparison for custom items (22 Sep 2026): a real
// menu item's price is always a live lookup from its productId, so two
// lines of the same product already always share a price — this changes
// nothing for them. A custom item's price is typed by the cashier and has
// no such guarantee (same name, different price, typed twice), so without
// this check two differently-priced custom lines sharing a name would
// silently merge and drop one of the prices.
export function sameCartLine(
  a: Pick<CartItem, "productId" | "addons" | "notes" | "unitPrice">,
  b: Pick<CartItem, "productId" | "addons" | "notes" | "unitPrice">,
): boolean {
  if (a.productId !== b.productId) return false;
  if (a.unitPrice !== b.unitPrice) return false;
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

// Builds the request shape saveOrder/addItemsToOrder expect (OrderItemInput,
// build-order-items.ts) — kept here instead of imported from there, because
// that module pulls in `prisma` and this file is imported by client
// components (CLAUDE.md-worthy brief: a value import of a Prisma-touching
// module in a client component breaks the whole route). TypeScript checks
// the shape structurally against the server action's parameter type, so no
// import is needed for this to type-check correctly at each call site.
export function cartItemToOrderItemInput(item: CartItem) {
  if (item.isCustom) {
    return { kind: "custom" as const, name: item.productName, price: item.unitPrice, notes: item.notes, qty: item.qty };
  }
  return {
    kind: "product" as const,
    productId: item.productId,
    addonOptionIds: expandAddonOptionIds(item.addons),
    notes: item.notes,
    qty: item.qty,
  };
}
