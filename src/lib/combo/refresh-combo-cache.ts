import { prisma } from "@/lib/prisma";
import { buildComboKey } from "@/lib/orders/pricing";
import { formatAddonWithQty } from "@/lib/printing/format";
import { POPULAR_COMBO_DEFAULT_MIN_SALES } from "@/lib/settings/popular-combo";
import { NAMED_COMBOS, POPULAR_COMBO_WINDOW_DAYS } from "./named-combos";
import type { ComboShortcutItem } from "./types";

// A qty-2 addon (e.g. Ceker x2) is stored as two OrderItemAddon rows with
// the same addonOptionId (see expandAddonOptionIds) — group them back into
// one entry with a qty before they become part of a combo's identity/label,
// so an aggregated combo shows "Ceker x2" instead of "Ceker, Ceker".
function groupAddonRows(
  addons: { addonOptionId: string; name: string }[],
): { addonOptionId: string; name: string; qty: number }[] {
  const byId = new Map<string, { addonOptionId: string; name: string; qty: number }>();
  for (const a of addons) {
    const existing = byId.get(a.addonOptionId);
    if (existing) existing.qty += 1;
    else byId.set(a.addonOptionId, { ...a, qty: 1 });
  }
  return [...byId.values()];
}

type ComboCacheRow = {
  comboKey: string;
  displayName: string;
  totalPrice: number;
  salesCount30d: number;
  items: ComboShortcutItem[];
};

// Resolves NAMED_COMBOS (product/addon *names*) against the live, active
// menu — comboKey + current price + the curated "bahasa warung" label. Used
// both as the fallback list (before 30 days of real data exist) and to let
// a real aggregated combo pick up a curated name when its comboKey matches
// one of these (see aggregateRealCombos below). Only active products/addons
// are considered on purpose: a soft-deleted item should never surface as a
// tappable shortcut — buildOrderItemsCreateData would just reject it at
// save time, a dead-end for the cashier.
async function resolveNamedCombos(): Promise<ComboCacheRow[]> {
  const productNames = [...new Set(NAMED_COMBOS.map((c) => c.productName))];
  const products = await prisma.product.findMany({ where: { name: { in: productNames }, isActive: true } });
  const productByName = new Map(products.map((p) => [p.name, p]));

  const addonOptions = await prisma.addonOption.findMany({
    where: { isActive: true },
    include: { addonGroup: true },
  });
  const optionByGroupAndName = new Map(addonOptions.map((o) => [`${o.addonGroup.name}::${o.name}`, o]));

  const rows: ComboCacheRow[] = [];
  for (const combo of NAMED_COMBOS) {
    const product = productByName.get(combo.productName);
    if (!product) continue; // menu changed since — skip rather than crash the daily refresh
    const options = combo.addonKeys.map((key) => optionByGroupAndName.get(key));
    if (options.some((o) => !o)) continue;
    const resolved = options as NonNullable<(typeof options)[number]>[];

    const comboKey = buildComboKey(
      product.id,
      resolved.map((o) => o.id),
    );
    const totalPrice = product.price + resolved.reduce((sum, o) => sum + o.price, 0);

    rows.push({
      comboKey,
      displayName: combo.displayName,
      totalPrice,
      salesCount30d: 0,
      items: [
        {
          productId: product.id,
          name: product.name,
          qty: 1,
          addons: resolved.map((o) => ({ addonOptionId: o.id, name: o.name, qty: 1 })),
        },
      ],
    });
  }
  return rows;
}

// Fallback label for a real combo that crossed the threshold but isn't one
// of the hand-named combos — space-joined product + add-on names ("Mie Ayam
// Bakso Ceker"), not a "Product + Addon + Addon" formula string. Still not
// truly curated "bahasa warung" (nobody named it), but it's the closest
// safe approximation until an owner does — see CLAUDE.md.
function naturalLanguageLabel(productName: string, addonNames: string[]): string {
  return [productName, ...addonNames].join(" ");
}

// Real-data aggregation: rolling 30-day window of PAID orders, grouped by
// comboKey (product + exact add-on set — see buildComboKey), summed by qty.
// A combo needs at least `minSales` (Setting.popularComboMinSales) to qualify.
// Items with zero add-ons never qualify — a plain product is already one
// tap on the grid, so a shortcut for it saves nothing (CLAUDE.md rule).
async function aggregateRealCombos(
  namedByComboKey: Map<string, string>,
  minSales: number,
): Promise<ComboCacheRow[]> {
  const windowStart = new Date(Date.now() - POPULAR_COMBO_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const items = await prisma.orderItem.findMany({
    where: { order: { status: "PAID", paidAt: { gte: windowStart } } },
    include: { addons: true },
  });

  const grouped = new Map<
    string,
    { productId: string; productName: string; addons: { addonOptionId: string; name: string; qty: number }[]; qty: number }
  >();

  for (const item of items) {
    // Also the reason a custom item ("+ Item Custom", productId null) can
    // never reach this point: it's never created with any addons.
    if (item.addons.length === 0) continue;
    const key = item.comboKey ?? buildComboKey(item.productId!, item.addons.map((a) => a.addonOptionId));
    const existing = grouped.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      grouped.set(key, {
        productId: item.productId!,
        productName: item.productName,
        addons: groupAddonRows(item.addons.map((a) => ({ addonOptionId: a.addonOptionId, name: a.name }))),
        qty: item.qty,
      });
    }
  }

  const qualifying = [...grouped.entries()].filter(([, g]) => g.qty >= minSales);
  if (qualifying.length === 0) return [];

  // Price at current (not historical snapshot) rates — same "stale up to a
  // day" tradeoff the cache accepts everywhere else, and never the number
  // actually charged (buildOrderItemsCreateData re-reads live prices again
  // at save time regardless of what a shortcut card shows). Only active
  // items qualify, for the same dead-end-tap reason as resolveNamedCombos.
  const productIds = [...new Set(qualifying.map(([, g]) => g.productId))];
  const addonIds = [...new Set(qualifying.flatMap(([, g]) => g.addons.map((a) => a.addonOptionId)))];
  const [products, addonOptions] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } }),
    prisma.addonOption.findMany({ where: { id: { in: addonIds }, isActive: true } }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const addonById = new Map(addonOptions.map((a) => [a.id, a]));

  return qualifying
    .map(([comboKey, g]) => {
      const product = productById.get(g.productId);
      if (!product) return null;
      if (g.addons.some((a) => !addonById.has(a.addonOptionId))) return null;
      const totalPrice =
        product.price + g.addons.reduce((sum, a) => sum + (addonById.get(a.addonOptionId)?.price ?? 0), 0);
      return {
        comboKey,
        displayName:
          namedByComboKey.get(comboKey) ?? naturalLanguageLabel(g.productName, g.addons.map(formatAddonWithQty)),
        totalPrice,
        salesCount30d: g.qty,
        items: [{ productId: g.productId, name: g.productName, qty: 1, addons: g.addons }],
      };
    })
    .filter((row): row is ComboCacheRow => row !== null);
}

// Called once a day at shift close (never on-demand from a live screen —
// see CLAUDE.md "Menu populer"). Full replace, not a merge: real 30-day
// data "takes over" from the 6 manual seed combos the moment at least one
// real combo crosses the threshold; until then the seed combos are shown
// so the shortcut row isn't empty on day one.
export async function refreshComboCache(): Promise<void> {
  const namedRows = await resolveNamedCombos();
  const namedByComboKey = new Map(namedRows.map((r) => [r.comboKey, r.displayName]));

  // Owner-tunable threshold (Pengaturan). A missing singleton row falls back
  // to the historical default rather than failing the daily refresh.
  const setting = await prisma.setting.findUnique({
    where: { id: "singleton" },
    select: { popularComboMinSales: true },
  });
  const minSales = setting?.popularComboMinSales ?? POPULAR_COMBO_DEFAULT_MIN_SALES;

  const real = await aggregateRealCombos(namedByComboKey, minSales);
  const rows = real.length > 0 ? real : namedRows;

  await prisma.$transaction([
    prisma.comboCache.deleteMany({}),
    ...rows.map((row) =>
      prisma.comboCache.create({
        data: {
          comboKey: row.comboKey,
          displayName: row.displayName,
          totalPrice: row.totalPrice,
          salesCount30d: row.salesCount30d,
          items: row.items,
        },
      }),
    ),
  ]);
}
