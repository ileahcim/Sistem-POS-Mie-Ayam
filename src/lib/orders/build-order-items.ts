import { prisma } from "@/lib/prisma";
import { DELIVERY_CHARGEABLE_CATEGORY_NAME } from "@/lib/menu/get-active-menu";
import { buildComboKey } from "./pricing";

export type OrderItemInput =
  | { kind: "product"; productId: string; addonOptionIds: string[]; notes: string; qty: number }
  // "+ Item Custom" — free name/price the cashier types for something
  // outside the menu (CLAUDE.md-worthy brief, 22 Sep 2026). Always treated
  // as Makanan for reading order and kertas dapur eligibility (owner's
  // explicit call), costPrice always 0 (nothing to snapshot), never part of
  // Menu Populer (aggregateRealCombos already skips any item with zero
  // addons, which every custom item has).
  | { kind: "custom"; name: string; price: number; notes: string; qty: number };

// The row shape prisma.orderItem.create needs — written out explicitly
// (rather than derived from buildOrderItemsCreateData's return type) so it
// doesn't circularly depend on the function whose body constructs it.
export type OrderItemCreateData = {
  productId: string | null; // null for a custom item — no real Product row
  productName: string;
  unitPrice: number;
  costPrice: number | null;
  qty: number;
  notes: string | null;
  isDeliveryChargeable: boolean;
  isKitchenItem: boolean;
  comboKey: string | null; // null for a custom item — never part of Menu Populer
  lineTotal: number;
  addons: { create: { addonOptionId: string; name: string; price: number; costPrice: number | null }[] };
};

// Everything a kitchen ticket (or any other future printout) needs about one
// line that ISN'T part of OrderItemCreateData above — kept as a separate,
// parallel array rather than extra properties on the create-data objects,
// because those objects go straight into prisma.orderItem.create and Prisma
// rejects unknown properties at runtime (a TS-level excess-property check
// would not catch it here, since itemsData is a variable, not an object
// literal). See build-kitchen-ticket-data.ts for the consumer.
export type OrderItemDisplayData = {
  // The real Product id for a normal line. For a custom item this is a
  // SYNTHETIC per-line grouping key (`custom:<name>`), never a real DB id —
  // line-order.ts's per-product grouping (layoutOrderLines) needs SOME
  // string to tell two different lines apart, and two custom items with
  // different names must never be grouped into one "block" together just
  // because neither has a real product behind it.
  productId: string;
  productName: string;
  isCustom: boolean;
  qty: number;
  notes: string | null;
  unitPrice: number;
  addons: { name: string; price: number }[];
  isDeliveryChargeable: boolean;
  isKitchenItem: boolean;
  categorySortOrder: number;
  productSortOrder: number;
};

function customGroupingKey(name: string): string {
  return `custom:${name}`;
}

// Folds identical inputs into one row before anything is written. The cart
// already merges on screen (upsertCartLine), but the rule that two identical
// lines are ONE line belongs here too: this is the last point before the
// rows exist, prices are read once for the whole call so merging can't blur
// two different prices, and a client that gets it wrong can no longer put a
// duplicate row into an order.
export function mergeOrderItemInputs(items: OrderItemInput[]): OrderItemInput[] {
  const merged: OrderItemInput[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const key =
      item.kind === "product"
        ? ["product", item.productId, (item.notes ?? "").trim(), [...item.addonOptionIds].sort().join("_")].join("::")
        // Multiset: two Ceker is not the same selection as one (product
        // case). A custom item has no addons to multiset over — name AND
        // price both have to match for two typed-in lines to be "the same".
        : ["custom", item.name.trim(), item.price, (item.notes ?? "").trim()].join("::");
    const existing = indexByKey.get(key);
    if (existing != null) merged[existing] = { ...merged[existing], qty: merged[existing].qty + item.qty };
    else {
      indexByKey.set(key, merged.length);
      merged.push({ ...item, notes: (item.notes ?? "").trim() });
    }
  }

  return merged;
}

// Shared by order creation (kasir) and "tambah item" on an existing order —
// both need the exact same rule: re-read price/name/cost from the DB right
// now and snapshot it, never trust whatever the client cart displayed.
// Throws a plain Error with a cashier-facing message on invalid ids so
// callers can surface it directly.
export async function buildOrderItemsCreateData(rawItems: OrderItemInput[]) {
  if (rawItems.length === 0) throw new Error("Tidak ada item.");
  const items = mergeOrderItemInputs(rawItems);

  const productItems = items.filter((i) => i.kind === "product");
  const customItems = items.filter((i) => i.kind === "custom");

  const productIds = [...new Set(productItems.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { category: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const addonOptionIds = [...new Set(productItems.flatMap((i) => i.addonOptionIds))];
  const addonOptions = await prisma.addonOption.findMany({
    where: { id: { in: addonOptionIds }, isActive: true },
  });
  const addonById = new Map(addonOptions.map((a) => [a.id, a]));

  for (const item of productItems) {
    if (!productById.has(item.productId)) {
      throw new Error("Salah satu produk sudah tidak tersedia. Muat ulang halaman.");
    }
    for (const addonId of item.addonOptionIds) {
      if (!addonById.has(addonId)) {
        throw new Error("Salah satu topping sudah tidak tersedia. Muat ulang halaman.");
      }
    }
  }

  // A custom item is "dianggap kategori Makanan" (owner's explicit call, not
  // hardcoded numbers — read live so it follows Makanan if its position or
  // isKitchenItem ever changes): drives reading order (sortOrderLines),
  // kertas dapur eligibility, and ongkir the exact same way a real Makanan
  // product would. Only fetched when the batch actually has a custom item.
  const makananCategory =
    customItems.length > 0
      ? await prisma.category.findUnique({ where: { name: DELIVERY_CHARGEABLE_CATEGORY_NAME } })
      : null;
  if (customItems.length > 0 && !makananCategory) {
    throw new Error("Kategori Makanan tidak ditemukan — hubungi pengembang.");
  }

  const createData: OrderItemCreateData[] = [];
  const display: OrderItemDisplayData[] = [];

  for (const item of productItems) {
    const product = productById.get(item.productId)!;
    const addons = item.addonOptionIds.map((id) => addonById.get(id)!);
    const unitTotal = product.price + addons.reduce((sum, a) => sum + a.price, 0);
    const isDeliveryChargeable = product.category.name === DELIVERY_CHARGEABLE_CATEGORY_NAME;

    createData.push({
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      costPrice: product.costPrice,
      qty: item.qty,
      notes: item.notes || null,
      isDeliveryChargeable,
      isKitchenItem: product.category.isKitchenItem,
      comboKey: buildComboKey(product.id, item.addonOptionIds),
      lineTotal: unitTotal * item.qty,
      addons: {
        create: addons.map((a) => ({
          addonOptionId: a.id,
          name: a.name,
          price: a.price,
          costPrice: a.costPrice,
        })),
      },
    });

    display.push({
      productId: product.id,
      productName: product.name,
      isCustom: false,
      qty: item.qty,
      notes: item.notes || null,
      unitPrice: product.price,
      addons: addons.map((a) => ({ name: a.name, price: a.price })),
      isDeliveryChargeable,
      isKitchenItem: product.category.isKitchenItem,
      categorySortOrder: product.category.sortOrder,
      productSortOrder: product.sortOrder,
    });
  }

  for (const item of customItems) {
    const name = item.name.trim();
    if (!name) throw new Error("Nama item custom tidak boleh kosong.");
    if (item.price < 0) throw new Error("Harga item custom tidak boleh negatif.");
    const category = makananCategory!;

    createData.push({
      productId: null,
      productName: name,
      unitPrice: item.price,
      costPrice: 0,
      qty: item.qty,
      notes: item.notes || null,
      isDeliveryChargeable: true, // Makanan
      isKitchenItem: category.isKitchenItem,
      comboKey: null,
      lineTotal: item.price * item.qty,
      addons: { create: [] },
    });

    display.push({
      productId: customGroupingKey(name),
      productName: name,
      isCustom: true,
      qty: item.qty,
      notes: item.notes || null,
      unitPrice: item.price,
      addons: [],
      isDeliveryChargeable: true,
      isKitchenItem: category.isKitchenItem,
      categorySortOrder: category.sortOrder,
      // Sorts after every real Makanan product (whose sortOrder is a small,
      // dense integer — see prisma/seed.ts) so custom items land at the end
      // of the Makanan block instead of interrupting the named menu's order.
      productSortOrder: Number.MAX_SAFE_INTEGER,
    });
  }

  return { items: createData, display };
}
