import { prisma } from "@/lib/prisma";
import { DELIVERY_CHARGEABLE_CATEGORY_NAME } from "@/lib/menu/get-active-menu";
import { buildComboKey } from "./pricing";

export type OrderItemInput = {
  productId: string;
  addonOptionIds: string[];
  notes: string;
  qty: number;
};

// The row shape prisma.orderItem.create needs — written out explicitly
// (rather than derived from buildOrderItemsCreateData's return type) so it
// doesn't circularly depend on the function whose body constructs it.
export type OrderItemCreateData = {
  productId: string;
  productName: string;
  unitPrice: number;
  costPrice: number | null;
  qty: number;
  notes: string | null;
  isDeliveryChargeable: boolean;
  isKitchenItem: boolean;
  comboKey: string;
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
  productId: string;
  productName: string;
  qty: number;
  notes: string | null;
  unitPrice: number;
  addons: { name: string; price: number }[];
  isDeliveryChargeable: boolean;
  isKitchenItem: boolean;
  categorySortOrder: number;
  productSortOrder: number;
};

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
    const key = [
      item.productId,
      (item.notes ?? "").trim(),
      // Multiset: two Ceker is not the same selection as one.
      [...item.addonOptionIds].sort().join("_"),
    ].join("::");
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

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { category: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const addonOptionIds = [...new Set(items.flatMap((i) => i.addonOptionIds))];
  const addonOptions = await prisma.addonOption.findMany({
    where: { id: { in: addonOptionIds }, isActive: true },
  });
  const addonById = new Map(addonOptions.map((a) => [a.id, a]));

  for (const item of items) {
    if (!productById.has(item.productId)) {
      throw new Error("Salah satu produk sudah tidak tersedia. Muat ulang halaman.");
    }
    for (const addonId of item.addonOptionIds) {
      if (!addonById.has(addonId)) {
        throw new Error("Salah satu topping sudah tidak tersedia. Muat ulang halaman.");
      }
    }
  }

  const createData: OrderItemCreateData[] = [];
  const display: OrderItemDisplayData[] = [];

  for (const item of items) {
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

  return { items: createData, display };
}
