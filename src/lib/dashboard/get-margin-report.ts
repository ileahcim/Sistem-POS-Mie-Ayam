import { prisma } from "@/lib/prisma";
import { DASHBOARD_WINDOW_DAYS } from "./config";

export type MarginByProduct = {
  productName: string;
  qty: number;
  omzet: number;
  hpp: number;
  margin: number;
  hasMissingCostPrice: boolean;
};

export type MarginReport = {
  totalOmzet: number;
  totalHpp: number;
  totalMargin: number;
  anyMissingCostPrice: boolean;
  byProduct: MarginByProduct[];
};

// Margin from the costPrice SNAPSHOT on each OrderItem/OrderItemAddon (never
// re-read from the live Product/AddonOption row) — same snapshot rule as
// everything else money-related in this app. costPrice is owner-entered and
// starts out unset (null, treated as 0 in the sum) for every product until
// filled in — hasMissingCostPrice/anyMissingCostPrice flag exactly that, so
// a margin number that's really just "HPP belum diisi" never gets read as
// genuine profit. Grouped by base product name (not full combo), scoped to
// PAID orders in the shared rolling window.
export async function getMarginReport(): Promise<MarginReport> {
  const since = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const items = await prisma.orderItem.findMany({
    where: { order: { status: "PAID", paidAt: { gte: since } } },
    include: { addons: true },
  });

  const byProduct = new Map<string, MarginByProduct>();

  for (const item of items) {
    const omzet = item.lineTotal;
    const itemCostMissing = item.costPrice == null;
    const addonCostMissing = item.addons.some((a) => a.costPrice == null);
    const hpp =
      (item.costPrice ?? 0) * item.qty + item.addons.reduce((sum, a) => sum + (a.costPrice ?? 0) * item.qty, 0);

    const existing = byProduct.get(item.productName);
    if (existing) {
      existing.qty += item.qty;
      existing.omzet += omzet;
      existing.hpp += hpp;
      existing.margin += omzet - hpp;
      existing.hasMissingCostPrice = existing.hasMissingCostPrice || itemCostMissing || addonCostMissing;
    } else {
      byProduct.set(item.productName, {
        productName: item.productName,
        qty: item.qty,
        omzet,
        hpp,
        margin: omzet - hpp,
        hasMissingCostPrice: itemCostMissing || addonCostMissing,
      });
    }
  }

  const rows = [...byProduct.values()].sort((a, b) => b.omzet - a.omzet);
  const totalOmzet = rows.reduce((sum, r) => sum + r.omzet, 0);
  const totalHpp = rows.reduce((sum, r) => sum + r.hpp, 0);
  const anyMissingCostPrice = rows.some((r) => r.hasMissingCostPrice);

  return {
    totalOmzet,
    totalHpp,
    totalMargin: totalOmzet - totalHpp,
    anyMissingCostPrice,
    byProduct: rows,
  };
}
