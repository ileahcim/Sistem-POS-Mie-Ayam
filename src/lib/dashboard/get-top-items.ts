import { prisma } from "@/lib/prisma";
import { DASHBOARD_WINDOW_DAYS } from "./config";

export type TopItemRow = {
  name: string;
  qty: number;
  omzet: number;
};

// Top base products (Menu) and top add-on options (Topping), each ranked
// independently by qty sold — not the same as Tahap 10's ComboCache, which
// ranks whole product+addon-set combinations. Both scoped to PAID orders
// only (VOID/RECEIVABLE never count as sales — CLAUDE.md "Dashboard") over
// the shared rolling window.
export async function getTopProducts(limit = 10): Promise<TopItemRow[]> {
  const since = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const items = await prisma.orderItem.findMany({
    where: { order: { status: "PAID", paidAt: { gte: since } } },
    select: { productName: true, qty: true, unitPrice: true },
  });

  const byName = new Map<string, TopItemRow>();
  for (const item of items) {
    const existing = byName.get(item.productName);
    const omzet = item.unitPrice * item.qty;
    if (existing) {
      existing.qty += item.qty;
      existing.omzet += omzet;
    } else {
      byName.set(item.productName, { name: item.productName, qty: item.qty, omzet });
    }
  }

  return [...byName.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export async function getTopToppings(limit = 10): Promise<TopItemRow[]> {
  const since = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const addons = await prisma.orderItemAddon.findMany({
    where: { orderItem: { order: { status: "PAID", paidAt: { gte: since } } } },
    select: { name: true, price: true, orderItem: { select: { qty: true } } },
  });

  const byName = new Map<string, TopItemRow>();
  for (const addon of addons) {
    const qty = addon.orderItem.qty;
    const omzet = addon.price * qty;
    const existing = byName.get(addon.name);
    if (existing) {
      existing.qty += qty;
      existing.omzet += omzet;
    } else {
      byName.set(addon.name, { name: addon.name, qty, omzet });
    }
  }

  return [...byName.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}
