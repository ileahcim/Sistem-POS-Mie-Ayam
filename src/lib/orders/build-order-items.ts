import { prisma } from "@/lib/prisma";
import { DELIVERY_CHARGEABLE_CATEGORY_NAME } from "@/lib/menu/get-active-menu";
import { buildComboKey } from "./pricing";

export type OrderItemInput = {
  productId: string;
  addonOptionIds: string[];
  notes: string;
  qty: number;
};

export type OrderItemCreateData = Awaited<ReturnType<typeof buildOrderItemsCreateData>>[number];

// Shared by order creation (kasir) and "tambah item" on an existing order —
// both need the exact same rule: re-read price/name/cost from the DB right
// now and snapshot it, never trust whatever the client cart displayed.
// Throws a plain Error with a cashier-facing message on invalid ids so
// callers can surface it directly.
export async function buildOrderItemsCreateData(items: OrderItemInput[]) {
  if (items.length === 0) throw new Error("Tidak ada item.");

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

  return items.map((item) => {
    const product = productById.get(item.productId)!;
    const addons = item.addonOptionIds.map((id) => addonById.get(id)!);
    const unitTotal = product.price + addons.reduce((sum, a) => sum + a.price, 0);

    return {
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      costPrice: product.costPrice,
      qty: item.qty,
      notes: item.notes || null,
      isDeliveryChargeable: product.category.name === DELIVERY_CHARGEABLE_CATEGORY_NAME,
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
    };
  });
}
