import type { DashboardOrder } from "./get-sales-data";

// Same 12 fields as the BaksoUsageSetting row — kept as a plain type here
// (not importing the Prisma model) so this stays a pure, client-safe file
// like the rest of aggregate-sales.ts.
export type BaksoUsageSettingValues = {
  baksoPolosKecil: number;
  baksoUratKecil: number;
  baksoUratUrat: number;
  baksoTelurKecil: number;
  baksoTelurTelur: number;
  toppingBaksoKecil: number;
  toppingBaksoUratUrat: number;
  toppingBaksoTelurTelur: number;
  baksoKecilProdukKecil: number;
  baksoSetengahKecil: number;
  baksoUratBijianUrat: number;
  baksoTelurBijianTelur: number;
};

export type BaksoUsageTotals = { kecil: number; urat: number; telur: number };

// Business-identity matching by exact product/addon NAME — same established
// pattern as NAMED_COMBOS / DELIVERY_CHARGEABLE_CATEGORY_NAME elsewhere in
// this codebase. Only the ball COUNTS (BaksoUsageSettingValues) are
// owner-editable data; which line matches which recipe slot is inherent to
// the menu structure itself (CLAUDE.md "Menu & harga").
const PRODUCT_BAKSO = "Bakso";
const PRODUCT_BAKSO_KECIL = "Bakso Kecil (3 biji)";
const PRODUCT_BAKSO_SETENGAH = "Bakso Setengah (4 biji)";
const PRODUCT_BAKSO_URAT_BIJIAN = "Bakso Urat (bijian)";
const PRODUCT_BAKSO_TELUR_BIJIAN = "Bakso Telur (bijian)";
// "Jenis Bakso" group (on product Bakso only) — options named just "Urat"/
// "Telur" since the 21 Sep 2026 short-label migration.
const ADDON_JENIS_BAKSO_URAT = "Urat";
const ADDON_JENIS_BAKSO_TELUR = "Telur";
// "Tambah Bakso" group (on Mie Ayam/Pangsit Rebus/Ceker) — a DIFFERENT
// group from Jenis Bakso above, with its own option names.
const ADDON_TAMBAH_BAKSO = "Bakso";
const ADDON_TAMBAH_BAKSO_URAT = "Bakso Urat";
const ADDON_TAMBAH_BAKSO_TELUR = "Bakso Telur";

// "Perkiraan Bakso Terpakai" (CLAUDE.md, 24 Sep 2026) — informational
// estimate only, never an inventory deduction. Custom items (productId
// null) never count (CLAUDE.md "Item Custom tidak dihitung"). The product
// "Bakso" bowl's own Jenis Bakso choice REPLACES its ball composition
// (fewer plain balls, one bigger one) rather than adding to it — picking
// Urat/Telur there uses baksoUrat*/baksoTelur*, not baksoPolosKecil plus
// something. The "Tambah Bakso" topping on a different host product
// (Mie Ayam/Pangsit Rebus/Ceker) is always additive on top of that host's
// own (zero) content, and structurally can never coexist with a Jenis
// Bakso pick on the same line (different products carry different groups).
export function computeBaksoUsage(orders: readonly DashboardOrder[], settings: BaksoUsageSettingValues): BaksoUsageTotals {
  let kecil = 0;
  let urat = 0;
  let telur = 0;

  for (const order of orders) {
    for (const item of order.items) {
      if (item.productId == null) continue; // "+ Item Custom" — never counted
      const addonNames = item.addons.map((a) => a.name);

      if (item.productName === PRODUCT_BAKSO) {
        if (addonNames.includes(ADDON_JENIS_BAKSO_URAT)) {
          kecil += settings.baksoUratKecil * item.qty;
          urat += settings.baksoUratUrat * item.qty;
        } else if (addonNames.includes(ADDON_JENIS_BAKSO_TELUR)) {
          kecil += settings.baksoTelurKecil * item.qty;
          telur += settings.baksoTelurTelur * item.qty;
        } else {
          kecil += settings.baksoPolosKecil * item.qty;
        }
      } else if (item.productName === PRODUCT_BAKSO_KECIL) {
        kecil += settings.baksoKecilProdukKecil * item.qty;
      } else if (item.productName === PRODUCT_BAKSO_SETENGAH) {
        kecil += settings.baksoSetengahKecil * item.qty;
      } else if (item.productName === PRODUCT_BAKSO_URAT_BIJIAN) {
        urat += settings.baksoUratBijianUrat * item.qty;
      } else if (item.productName === PRODUCT_BAKSO_TELUR_BIJIAN) {
        telur += settings.baksoTelurBijianTelur * item.qty;
      }

      // Independent of the product-level match above — "Tambah Bakso" is a
      // topping on a different host product entirely.
      if (addonNames.includes(ADDON_TAMBAH_BAKSO)) kecil += settings.toppingBaksoKecil * item.qty;
      if (addonNames.includes(ADDON_TAMBAH_BAKSO_URAT)) urat += settings.toppingBaksoUratUrat * item.qty;
      if (addonNames.includes(ADDON_TAMBAH_BAKSO_TELUR)) telur += settings.toppingBaksoTelurTelur * item.qty;
    }
  }

  return { kecil, urat, telur };
}
