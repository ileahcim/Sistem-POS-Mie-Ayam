import { prisma } from "@/lib/prisma";
import { LOW_MARGIN_THRESHOLD_PERCENT } from "@/lib/margin/config";
import { computeMarginPercent } from "./margin-math";

export type HppItem = {
  id: string;
  kind: "product" | "addon";
  name: string;
  price: number; // sell price (product) or price delta (addon option)
  costPrice: number | null;
  costPriceEstimated: boolean;
  marginIntentional: boolean;
};

export type HppSection = {
  title: string;
  items: HppItem[];
};

// Grouped the same way the owner already thinks about the menu: products by
// Category, add-ons by AddonGroup (an option belongs to exactly one group,
// even though a group can be shared across several products) — not by
// product, which would either repeat shared groups or need de-duplication
// for no benefit here. Only active rows: a soft-deleted product/option can
// never be sold again, so its costPrice can't affect any future margin.
export async function getHppItems(): Promise<{ products: HppSection[]; addons: HppSection[] }> {
  const categories = await prisma.category.findMany({
    where: { products: { some: { isActive: true } } },
    orderBy: { sortOrder: "asc" },
    include: { products: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });

  const products: HppSection[] = categories.map((c) => ({
    title: c.name,
    items: c.products.map((p) => ({
      id: p.id,
      kind: "product" as const,
      name: p.name,
      price: p.price,
      costPrice: p.costPrice,
      costPriceEstimated: p.costPriceEstimated,
      marginIntentional: p.marginIntentional,
    })),
  }));

  const addonGroups = await prisma.addonGroup.findMany({
    where: { options: { some: { isActive: true } } },
    orderBy: { name: "asc" },
    include: { options: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });

  const addons: HppSection[] = addonGroups.map((g) => ({
    title: g.name,
    items: g.options.map((o) => ({
      id: o.id,
      kind: "addon" as const,
      name: o.name,
      price: o.price,
      costPrice: o.costPrice,
      costPriceEstimated: o.costPriceEstimated,
      marginIntentional: o.marginIntentional,
    })),
  }));

  return { products, addons };
}

export function summarizeHppSections(sections: HppSection[]): { missing: number; lowMargin: number } {
  const all = sections.flatMap((s) => s.items);
  const missing = all.filter((i) => i.costPrice == null).length;
  const lowMargin = all.filter((i) => {
    if (i.costPrice == null || i.marginIntentional) return false;
    const pct = computeMarginPercent(i.price, i.costPrice);
    return pct != null && pct < LOW_MARGIN_THRESHOLD_PERCENT;
  }).length;
  return { missing, lowMargin };
}
