import { prisma } from "@/lib/prisma";

export type MenuAddonOption = {
  id: string;
  name: string;
  price: number;
};

export type MenuAddonGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number | null;
  options: MenuAddonOption[];
};

export type MenuProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  isDeliveryChargeable: boolean; // true only for Makanan-category products
  addonGroups: MenuAddonGroup[];
};

export type MenuCategory = {
  id: string;
  name: string;
  isKitchenItem: boolean;
  products: MenuProduct[];
};

// Ongkir applies per-portion to this one category by name, not a general
// "counts toward delivery" flag on Category — Minuman Racik also needs prep
// but is never charged delivery, so isKitchenItem can't stand in for this.
export const DELIVERY_CHARGEABLE_CATEGORY_NAME = "Makanan";

// Active menu only (soft-deleted products/options never show at the register)
// ordered exactly as the cashier screen should render it.
export async function getActiveMenu(): Promise<MenuCategory[]> {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          addonGroups: {
            orderBy: { sortOrder: "asc" },
            include: {
              addonGroup: {
                include: {
                  options: {
                    where: { isActive: true },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    isKitchenItem: category.isKitchenItem,
    products: category.products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      isDeliveryChargeable: category.name === DELIVERY_CHARGEABLE_CATEGORY_NAME,
      addonGroups: product.addonGroups.map((pag) => ({
        id: pag.addonGroup.id,
        name: pag.addonGroup.name,
        minSelect: pag.addonGroup.minSelect,
        maxSelect: pag.addonGroup.maxSelect,
        options: pag.addonGroup.options.map((opt) => ({
          id: opt.id,
          name: opt.name,
          price: opt.price,
        })),
      })),
    })),
  }));
}
