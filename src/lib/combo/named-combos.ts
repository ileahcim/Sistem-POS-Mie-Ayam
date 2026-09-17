// Shared by prisma/seed.ts (initial setup, before any real sales exist) and
// the daily refresh job (src/lib/combo/refresh-combo-cache.ts) as the
// fallback list while 30 days of real data hasn't crossed the threshold
// yet — see CLAUDE.md "Lain-lain: Menu populer". Pure data, no Prisma
// import, so it's safely importable from both a bare-tsx script and the
// Next.js app.
//
// Rule: only combos with at least one add-on belong here — a plain product
// is already one tap on the product grid, so shortcutting it saves nothing
// and just burns a slot. Every entry below has addonKeys.length >= 1.
//
// displayName is the "bahasa warung" label shown on the shortcut card —
// never derived from raw product+addon concatenation. Unnamed real combos
// that cross the threshold later (not in this list) fall back to a
// space-joined "Product Addon Addon" label in refresh-combo-cache.ts — see
// the comment there for why that's still not the same as a "+" formula.
export type NamedCombo = {
  displayName: string;
  productName: string;
  addonKeys: string[]; // "GroupName::OptionName", matches seed.ts's own verification pattern
};

export const NAMED_COMBOS: NamedCombo[] = [
  {
    displayName: "Mie Ayam Komplit",
    productName: "Mie Ayam",
    addonKeys: ["Topping Mie::Bakso", "Topping Mie::Pangsit", "Topping Mie::Ceker"],
  },
  {
    displayName: "Mie Ayam Bakso Urat",
    productName: "Mie Ayam",
    addonKeys: ["Topping Mie::Bakso Urat"],
  },
  {
    displayName: "Mie Ayam Bakso Telur",
    productName: "Mie Ayam",
    addonKeys: ["Topping Mie::Bakso Telur"],
  },
  {
    displayName: "Bakso Telur Komplit",
    productName: "Bakso",
    addonKeys: ["Jenis Bakso::Upgrade ke Telur", "Topping Bakso::Pangsit", "Topping Bakso::Ceker"],
  },
  {
    displayName: "Bakso Urat Ceker",
    productName: "Bakso",
    addonKeys: ["Jenis Bakso::Upgrade ke Urat", "Topping Bakso::Ceker"],
  },
  {
    displayName: "Pangsit Rebus Komplit",
    productName: "Pangsit Rebus",
    addonKeys: ["Topping Mie::Ceker", "Topping Mie::Bakso"],
  },
];

export const POPULAR_COMBO_MIN_SALES_30D = 10;
export const POPULAR_COMBO_WINDOW_DAYS = 30;
