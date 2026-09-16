import { prisma } from "@/lib/prisma";
import { DASHBOARD_WINDOW_DAYS } from "./config";
import { LOW_MARGIN_THRESHOLD_PERCENT } from "@/lib/margin/config";
import { computeMarginPercent } from "@/lib/hpp/margin-math";

export type LowMarginItem = {
  kind: "product" | "addon";
  name: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  marginPercent: number;
  totalMargin: number; // negative = real loss, small positive = just under the threshold
};

// Distinct from getMarginReport's per-order-line aggregation — this looks at
// each priced COMPONENT separately (a product's own cost, and each addon
// option's own cost), because a modifier can be a deliberate loss leader
// (CLAUDE.md: "Jenis Bakso — Urat" sells +3000 against a +3700 cost) while
// the order line it's attached to still nets positive overall — that loss
// would be invisible if only the combined line were ever looked at. Every
// occurrence across the window is included regardless of the item's current
// "margin tipis disengaja" flag: that flag only suppresses the confirmation
// nudge on the HPP admin page, not this monitor — the owner's stated reason
// for wanting this list is to watch whether a KNOWN loss leader's sales
// volume is growing, so hiding intentional ones would defeat the purpose.
// Items with no costPrice filled in at all are skipped (never claimed as a
// "loss" when the true cost is simply unknown — see anyMissingCostPrice).
export async function getLowMarginItems(): Promise<LowMarginItem[]> {
  const since = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const items = await prisma.orderItem.findMany({
    where: { order: { status: "PAID", paidAt: { gte: since } } },
    include: { addons: true },
  });

  const map = new Map<string, LowMarginItem>();

  function bump(kind: "product" | "addon", name: string, qty: number, unitPrice: number, unitCost: number | null) {
    if (unitCost == null) return;
    const pct = computeMarginPercent(unitPrice, unitCost);
    if (pct == null || pct >= LOW_MARGIN_THRESHOLD_PERCENT) return;

    const key = `${kind}:${name}`;
    const lineMargin = (unitPrice - unitCost) * qty;
    const existing = map.get(key);
    if (existing) {
      existing.qty += qty;
      existing.totalMargin += lineMargin;
    } else {
      map.set(key, { kind, name, qty, unitPrice, unitCost, marginPercent: pct, totalMargin: lineMargin });
    }
  }

  for (const item of items) {
    bump("product", item.productName, item.qty, item.unitPrice, item.costPrice);
    for (const a of item.addons) {
      bump("addon", a.name, item.qty, a.price, a.costPrice);
    }
  }

  return [...map.values()].sort((a, b) => a.totalMargin - b.totalMargin);
}
