import { prisma } from "@/lib/prisma";
import { ICE_CREAM_CATEGORY_NAME } from "@/lib/stock/types";

export type AdminProduct = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  categoryId: string;
  addonGroupIds: string[];
};

export type AdminCategory = {
  id: string;
  name: string;
  products: AdminProduct[];
};

export type AdminAddonOption = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
};

export type AdminAddonGroup = {
  id: string;
  name: string;
  options: AdminAddonOption[];
};

// Unlike get-hpp-items.ts (active only — a soft-deleted item can't affect
// future margin), this page shows EVERYTHING, active and inactive, since
// "nonaktifkan" needs to see what's already off to turn it back on.
export async function getMenuAdminData(): Promise<{ categories: AdminCategory[]; addonGroups: AdminAddonGroup[] }> {
  // Es krim lives on /es-krim (stock, box price, modal per pcs) — kept off
  // this page so there is one place per concern (docs/spec-es-krim.md).
  const categories = await prisma.category.findMany({
    where: { name: { not: ICE_CREAM_CATEGORY_NAME } },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: { addonGroups: { select: { addonGroupId: true } } },
      },
    },
  });

  const addonGroups = await prisma.addonGroup.findMany({
    orderBy: { name: "asc" },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      products: c.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        isActive: p.isActive,
        categoryId: c.id,
        addonGroupIds: p.addonGroups.map((g) => g.addonGroupId),
      })),
    })),
    addonGroups: addonGroups.map((g) => ({
      id: g.id,
      name: g.name,
      options: g.options.map((o) => ({ id: o.id, name: o.name, price: o.price, isActive: o.isActive })),
    })),
  };
}
