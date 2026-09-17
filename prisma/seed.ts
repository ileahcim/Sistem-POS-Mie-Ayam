import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildComboKey } from "../src/lib/orders/pricing";
import { NAMED_COMBOS } from "../src/lib/combo/named-combos";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

type ProductSeed = { name: string; price: number };
type CategorySeed = {
  name: string;
  sortOrder: number;
  isKitchenItem: boolean;
  products: ProductSeed[];
};

// Screen order: Makanan, Minuman Racik, Kulkas, Lain-lain, Frozen.
const categories: CategorySeed[] = [
  {
    name: "Makanan",
    sortOrder: 0,
    isKitchenItem: true,
    products: [
      { name: "Mie Ayam", price: 13000 },
      { name: "Bakso", price: 13000 },
      { name: "Pangsit Rebus", price: 13000 },
      { name: "Ceker", price: 12000 },
      // Satuan/piece items — separate products, not addons. A standard
      // Bakso bowl already includes 4 small balls + 1 urat via "Jenis
      // Bakso" below; these are for buying extra balls by the piece
      // (e.g. 2x Bakso Urat (bijian) with no bowl at all = 20.000). Kept
      // at the bottom of the grid + "(bijian)" suffix so they don't get
      // confused with ordering a full Bakso bowl.
      { name: "Bakso Urat (bijian)", price: 10000 },
      { name: "Bakso Telur (bijian)", price: 10000 },
    ],
  },
  {
    name: "Minuman Racik",
    sortOrder: 1,
    isKitchenItem: true,
    products: [
      { name: "Es Teh", price: 5000 },
      { name: "Lemon Tea", price: 6000 },
      { name: "Es Jeruk", price: 6000 },
      { name: "Teh Manis", price: 4000 },
      { name: "Teh Tawar", price: 3000 },
    ],
  },
  {
    name: "Kulkas",
    sortOrder: 2,
    isKitchenItem: false,
    products: [
      { name: "Air Mineral", price: 3000 },
      { name: "Air Gelas", price: 1000 },
      { name: "Teh Pucuk", price: 4000 },
      { name: "Teh Botol Kaca", price: 4000 },
      { name: "Frutea Kaca", price: 4000 },
      { name: "Cimory", price: 10000 },
      { name: "Cimory Kecil", price: 3000 },
      { name: "Yakult", price: 3000 },
    ],
  },
  {
    name: "Lain-lain",
    sortOrder: 3,
    isKitchenItem: false,
    products: [
      { name: "Es Batu", price: 1000 },
      { name: "Kerupuk Besar", price: 2000 },
      { name: "Kerupuk Kecil", price: 1000 },
    ],
  },
  {
    name: "Frozen",
    sortOrder: 4,
    isKitchenItem: false,
    products: [{ name: "Mie Frozen", price: 9000 }],
  },
];

type AddonOptionSeed = { name: string; price: number; isActive?: boolean };
type AddonGroupSeed = {
  name: string;
  minSelect: number;
  maxSelect: number | null;
  appliesTo: string[]; // product names
  options: AddonOptionSeed[];
};

const addonGroups: AddonGroupSeed[] = [
  {
    name: "Topping Mie",
    minSelect: 0,
    maxSelect: null,
    appliesTo: ["Mie Ayam", "Pangsit Rebus", "Ceker"],
    options: [
      { name: "Bakso", price: 5000 },
      { name: "Bakso Urat", price: 8000 },
      { name: "Pangsit", price: 2000 },
      { name: "Ceker", price: 2000 },
      { name: "Bakso Telur", price: 10000 },
    ],
  },
  {
    // Optional single-choice: picking nothing = plain Bakso at the base
    // price (the most common order), so there's no "Biasa" option to tap.
    // The old "Biasa" row on existing databases is soft-deleted by
    // migration 20260917100200_bakso_jenis_optional, which also renamed
    // "Urat"/"Telur" to the names below in place.
    name: "Jenis Bakso",
    minSelect: 0,
    maxSelect: 1,
    appliesTo: ["Bakso"],
    options: [
      { name: "Upgrade ke Urat", price: 3000 },
      { name: "Upgrade ke Telur", price: 5000 },
    ],
  },
  {
    name: "Topping Bakso",
    minSelect: 0,
    maxSelect: null,
    appliesTo: ["Bakso"],
    options: [
      { name: "Pangsit", price: 2000 },
      { name: "Ceker", price: 2000 },
    ],
  },
];

async function main() {
  // Singleton row — never created twice, never deleted. Placeholder values
  // are meant to be edited from the admin settings page (stage 5), not here.
  await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      storeName: "Mie Ayam Pangsit dan Bakso Ciptarasa 4 Wonogiri",
      receiptFooter: "Terima kasih!",
    },
  });

  const productByName = new Map<string, { id: string; price: number }>();

  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder, isKitchenItem: cat.isKitchenItem },
      create: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        isKitchenItem: cat.isKitchenItem,
      },
    });

    for (const [index, p] of cat.products.entries()) {
      const existing = await prisma.product.findFirst({
        where: { name: p.name, categoryId: category.id },
      });
      const product = existing
        ? await prisma.product.update({
            where: { id: existing.id },
            data: { price: p.price, sortOrder: index },
          })
        : await prisma.product.create({
            data: {
              name: p.name,
              price: p.price,
              categoryId: category.id,
              sortOrder: index,
            },
          });
      productByName.set(p.name, { id: product.id, price: product.price });
    }
  }

  const optionByGroupAndName = new Map<string, { id: string; price: number }>();

  for (const group of addonGroups) {
    const addonGroup = await prisma.addonGroup.upsert({
      where: { name: group.name },
      update: { minSelect: group.minSelect, maxSelect: group.maxSelect },
      create: {
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
      },
    });

    for (const [index, opt] of group.options.entries()) {
      const isActive = opt.isActive ?? true;
      const existing = await prisma.addonOption.findFirst({
        where: { name: opt.name, addonGroupId: addonGroup.id },
      });
      const option = existing
        ? await prisma.addonOption.update({
            where: { id: existing.id },
            data: { price: opt.price, sortOrder: index, isActive },
          })
        : await prisma.addonOption.create({
            data: {
              name: opt.name,
              price: opt.price,
              addonGroupId: addonGroup.id,
              sortOrder: index,
              isActive,
            },
          });
      optionByGroupAndName.set(`${group.name}::${opt.name}`, {
        id: option.id,
        price: option.price,
      });
    }

    for (const productName of group.appliesTo) {
      const product = productByName.get(productName);
      if (!product) throw new Error(`Seed error: product "${productName}" not found for addon group "${group.name}"`);
      await prisma.productAddonGroup.upsert({
        where: { productId_addonGroupId: { productId: product.id, addonGroupId: addonGroup.id } },
        update: {},
        create: { productId: product.id, addonGroupId: addonGroup.id },
      });
    }
  }

  console.log(`Seeded ${categories.length} categories, ${productByName.size} products, ${addonGroups.length} addon groups.`);

  verifySeedPrices(productByName, optionByGroupAndName);
  await seedComboCache(productByName, optionByGroupAndName);
}

// Menu populer: the 6 manual named combos, used as the "Menu Populer"
// shortcut row before 30 days of real sales data crosses the threshold —
// see CLAUDE.md "Menu populer" and src/lib/combo/refresh-combo-cache.ts.
// Only seeds on a fresh install (ComboCache empty) — once real sales data
// has taken over the cache, re-running this script must never contaminate
// it back with the fallback placeholders.
//
// Prices are computed from the SAME productByName/optionByGroupAndName maps
// verifySeedPrices just validated above — never hardcoded here, so any
// future menu price change (like the Bakso Urat/Telur satuan split or the
// Bakso Telur topping price) is automatically reflected without touching
// this function.
async function seedComboCache(
  products: Map<string, { id: string; price: number }>,
  options: Map<string, { id: string; price: number }>,
) {
  const existingCount = await prisma.comboCache.count();
  if (existingCount > 0) {
    console.log("ComboCache already has data (real sales likely took over) — skipping seed.");
    return;
  }

  for (const combo of NAMED_COMBOS) {
    const product = products.get(combo.productName);
    if (!product) throw new Error(`Seed error: product "${combo.productName}" not found for combo "${combo.displayName}"`);
    const resolvedOptions = combo.addonKeys.map((key) => {
      const option = options.get(key);
      if (!option) throw new Error(`Seed error: addon option "${key}" not found for combo "${combo.displayName}"`);
      return { key, ...option };
    });

    const comboKey = buildComboKey(
      product.id,
      resolvedOptions.map((o) => o.id),
    );
    const totalPrice = product.price + resolvedOptions.reduce((sum, o) => sum + o.price, 0);

    await prisma.comboCache.create({
      data: {
        comboKey,
        displayName: combo.displayName,
        totalPrice,
        salesCount30d: 0,
        items: [
          {
            productId: product.id,
            name: combo.productName,
            qty: 1,
            addons: resolvedOptions.map((o) => ({ addonOptionId: o.id, name: o.key.split("::")[1], qty: 1 })),
          },
        ],
      },
    });
  }

  console.log(`Seeded ${NAMED_COMBOS.length} combo cache rows.`);
}

// Cross-check the base-product + add-on structure actually reproduces the
// real menu prices given in the brief. If this throws, the seed data itself
// is wrong, not the app logic.
function verifySeedPrices(
  products: Map<string, { id: string; price: number }>,
  options: Map<string, { id: string; price: number }>,
) {
  const priceOf = (productName: string, addonKeys: string[]) => {
    const base = products.get(productName)?.price;
    if (base === undefined) throw new Error(`Unknown product in verification: ${productName}`);
    const addonsTotal = addonKeys.reduce((sum, key) => {
      const price = options.get(key)?.price;
      if (price === undefined) throw new Error(`Unknown addon option in verification: ${key}`);
      return sum + price;
    }, 0);
    return base + addonsTotal;
  };

  const checks: { label: string; actual: number; expected: number }[] = [
    {
      label: "Mie Ayam Komplit (Bakso, Pangsit, Ceker)",
      actual: priceOf("Mie Ayam", [
        "Topping Mie::Bakso",
        "Topping Mie::Pangsit",
        "Topping Mie::Ceker",
      ]),
      expected: 22000,
    },
    {
      label: "Bakso Telur Komplit (Telur, Pangsit, Ceker)",
      actual: priceOf("Bakso", [
        "Jenis Bakso::Upgrade ke Telur",
        "Topping Bakso::Pangsit",
        "Topping Bakso::Ceker",
      ]),
      expected: 22000,
    },
    {
      label: "Bakso polos (Jenis Bakso tidak dipilih)",
      actual: priceOf("Bakso", []),
      expected: 13000,
    },
    {
      label: "Bakso Urat Ceker",
      actual: priceOf("Bakso", ["Jenis Bakso::Upgrade ke Urat", "Topping Bakso::Ceker"]),
      expected: 18000,
    },
    {
      label: "Mie Ayam Bakso Urat",
      actual: priceOf("Mie Ayam", ["Topping Mie::Bakso Urat"]),
      expected: 21000,
    },
    {
      label: "Mie Ayam Bakso Telur (topping)",
      actual: priceOf("Mie Ayam", ["Topping Mie::Bakso Telur"]),
      expected: 23000,
    },
    {
      label: "Pangsit Rebus Ceker Bakso",
      actual: priceOf("Pangsit Rebus", ["Topping Mie::Ceker", "Topping Mie::Bakso"]),
      expected: 20000,
    },
  ];

  let allOk = true;
  for (const check of checks) {
    const ok = check.actual === check.expected;
    if (!ok) allOk = false;
    console.log(
      `${ok ? "OK  " : "FAIL"}  ${check.label}: expected ${check.expected}, got ${check.actual}`,
    );
  }
  if (!allOk) throw new Error("Seed price verification failed — see FAIL lines above.");
  console.log("All seed price verifications passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
