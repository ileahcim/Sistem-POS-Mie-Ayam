import type { DashboardOrder } from "./get-sales-data";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "@/lib/orders/pricing";
import { LOW_MARGIN_THRESHOLD_PERCENT } from "@/lib/margin/config";
import { computeMarginPercent } from "@/lib/hpp/margin-math";
import { normalizeRange, type DateRange } from "@/lib/date-range/presets";

// Pure, synchronous aggregations over the raw order list from
// get-sales-data.ts — every Dashboard section that used to run its own
// Prisma query against a fixed rolling window (Section 3-5, formerly
// DASHBOARD_WINDOW_DAYS) now reads the SAME filtered array, so they can
// never disagree about which orders are "in range" (same guarantee as
// Ringkasan Mi Mentah's bucket-mie.ts). Client-safe: no Prisma import here.

export function filterOrdersByRange(orders: DashboardOrder[], range: DateRange): DashboardOrder[] {
  const safe = normalizeRange(range);
  return orders.filter((o) => o.day >= safe.from && o.day <= safe.to);
}

export type TopItemRow = { name: string; qty: number; omzet: number };

// Top base products (Menu) and top add-on options (Topping), each ranked
// independently by qty sold — not the same as Tahap 10's ComboCache, which
// ranks whole product+addon combinations.
export function computeTopProducts(orders: DashboardOrder[], limit = 10): TopItemRow[] {
  const byName = new Map<string, TopItemRow>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = byName.get(item.productName);
      const omzet = item.unitPrice * item.qty;
      if (existing) {
        existing.qty += item.qty;
        existing.omzet += omzet;
      } else {
        byName.set(item.productName, { name: item.productName, qty: item.qty, omzet });
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export function computeTopToppings(orders: DashboardOrder[], limit = 10): TopItemRow[] {
  const byName = new Map<string, TopItemRow>();
  for (const order of orders) {
    for (const item of order.items) {
      for (const addon of item.addons) {
        const omzet = addon.price * item.qty;
        const existing = byName.get(addon.name);
        if (existing) {
          existing.qty += item.qty;
          existing.omzet += omzet;
        } else {
          byName.set(addon.name, { name: addon.name, qty: item.qty, omzet });
        }
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}

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
  // "+ Item Custom" lines are deliberately kept OUT of
  // byProduct/totalOmzet/totalHpp above — their costPrice is always a
  // literal 0 (nothing to snapshot, not "unknown"), so mixing them into
  // margin% would misreport genuine product margin as better than it is.
  // Shown as its own line instead so the rupiah isn't just dropped.
  customItemCount: number;
  customItemOmzet: number;
};

// Margin from the costPrice SNAPSHOT on each sold line (never re-read from
// the live Product/AddonOption row) — costPrice is owner-entered and starts
// out unset (null, treated as 0 in the sum) for every product until filled
// in — hasMissingCostPrice/anyMissingCostPrice flag exactly that, so a
// margin number that's really just "HPP belum diisi" never gets read as
// genuine profit. Grouped by base product name (not full combo).
export function computeMarginReport(orders: DashboardOrder[]): MarginReport {
  const byProduct = new Map<string, MarginByProduct>();
  let customItemCount = 0;
  let customItemOmzet = 0;

  for (const order of orders) {
    for (const item of order.items) {
      const omzet = item.lineTotal;
      if (item.productId == null) {
        customItemCount += item.qty;
        customItemOmzet += omzet;
        continue;
      }
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
    customItemCount,
    customItemOmzet,
  };
}

export type LowMarginItem = {
  kind: "product" | "addon";
  name: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  marginPercent: number;
  totalMargin: number; // negative = real loss, small positive = just under the threshold
};

// Distinct from computeMarginReport's per-order-line aggregation — this
// looks at each priced COMPONENT separately (a product's own cost, and each
// addon option's own cost), because a modifier can be a deliberate loss
// leader while the order line it's attached to still nets positive overall.
// Items with no costPrice filled in at all are skipped (never claimed as a
// "loss" when the true cost is simply unknown).
export function computeLowMarginItems(orders: DashboardOrder[]): LowMarginItem[] {
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

  for (const order of orders) {
    for (const item of order.items) {
      bump("product", item.productName, item.qty, item.unitPrice, item.costPrice);
      for (const a of item.addons) {
        bump("addon", a.name, item.qty, a.price, a.costPrice);
      }
    }
  }

  return [...map.values()].sort((a, b) => a.totalMargin - b.totalMargin);
}

export type ChannelBreakdownRow = {
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  orderCount: number;
  omzet: number;
};

const ALL_CHANNELS: ChannelBreakdownRow["channel"][] = ["DINE_IN", "BUNGKUS", "ANTAR"];

export function computeChannelBreakdown(orders: DashboardOrder[]): ChannelBreakdownRow[] {
  const byChannel = new Map<string, ChannelBreakdownRow>(
    ALL_CHANNELS.map((c) => [c, { channel: c, orderCount: 0, omzet: 0 }]),
  );

  for (const order of orders) {
    const subtotal = order.items.reduce((sum, i) => sum + i.lineTotal, 0);
    const deliveryFee =
      order.channel === "ANTAR"
        ? order.items.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) * DELIVERY_FEE_PER_FOOD_ITEM
        : 0;
    const row = byChannel.get(order.channel)!;
    row.orderCount += 1;
    row.omzet += subtotal + deliveryFee;
  }

  return ALL_CHANNELS.map((c) => byChannel.get(c)!);
}

export type CustomItemOrderRef = {
  orderId: string;
  orderNumber: number;
  queueNumber: number | null;
  queueSuffix: string;
  day: string;
  lineTotal: number;
};

export type CustomItemGroup = {
  name: string; // exactly what the cashier typed — the grouping key
  count: number; // how many order lines used this name (matches orders.length below)
  totalValue: number; // sum of lineTotal across all of them
  minPrice: number; // unitPrice range — flags a name that's been priced inconsistently
  maxPrice: number;
  orders: CustomItemOrderRef[]; // newest last (input order); caller sorts for display
};

// Grouped by the typed NAME, not by order line — a name that keeps coming
// back is the signal the owner is watching for ("kalau ada nama yang sering
// muncul, itu tanda harus dijadikan menu tetap", 23 Sep 2026), so two
// customers typing "Es Jeruk Besar" on different days must count as the
// same group. Sorted by how often the name was used, most first.
export function computeCustomItemGroups(orders: DashboardOrder[]): CustomItemGroup[] {
  const map = new Map<string, CustomItemGroup>();

  for (const order of orders) {
    for (const item of order.items) {
      if (item.productId != null) continue; // real product, not a custom item
      const ref: CustomItemOrderRef = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        queueNumber: order.queueNumber,
        queueSuffix: order.queueSuffix,
        day: order.day,
        lineTotal: item.lineTotal,
      };
      const existing = map.get(item.productName);
      if (existing) {
        existing.count += 1;
        existing.totalValue += item.lineTotal;
        existing.minPrice = Math.min(existing.minPrice, item.unitPrice);
        existing.maxPrice = Math.max(existing.maxPrice, item.unitPrice);
        existing.orders.push(ref);
      } else {
        map.set(item.productName, {
          name: item.productName,
          count: 1,
          totalValue: item.lineTotal,
          minPrice: item.unitPrice,
          maxPrice: item.unitPrice,
          orders: [ref],
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
}
