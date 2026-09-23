"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Manajemen Menu — CLAUDE.md-worthy brief, 22 Sep 2026: the owner asked
// whether they can add/change/deactivate products and add-ons themselves
// without going through a developer. Scope on purpose: this page owns
// catalog STRUCTURE (name, price, category, which add-on groups apply, and
// active/inactive) — cost/margin data stays on /admin/hpp, so there's one
// place per concern instead of the same fields editable in two places.
// Creating a brand-new AddonGroup (a whole new customization category, not
// just an option inside an existing one) is deliberately out of scope —
// rare enough, and risky enough (minSelect/maxSelect semantics feed
// AddonSheet's validation), that it's still a "tell the developer" case.

export type CreateProductInput = {
  name: string;
  price: number;
  categoryId: string;
  addonGroupIds: string[];
};

export async function createProduct(input: CreateProductInput): Promise<ActionResult> {
  await requireRole("OWNER");

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nama produk wajib diisi." };
  if (!Number.isFinite(input.price) || input.price < 0) return { ok: false, error: "Harga tidak valid." };

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) return { ok: false, error: "Kategori tidak ditemukan." };

  const last = await prisma.product.findFirst({
    where: { categoryId: input.categoryId },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  await prisma.product.create({
    data: {
      name,
      price: Math.round(input.price),
      categoryId: input.categoryId,
      sortOrder,
      addonGroups: {
        create: input.addonGroupIds.map((addonGroupId, i) => ({ addonGroupId, sortOrder: i })),
      },
    },
  });

  return { ok: true };
}

export type UpdateProductInput = {
  name: string;
  price: number;
  categoryId: string;
  addonGroupIds: string[];
};

export async function updateProduct(productId: string, input: UpdateProductInput): Promise<ActionResult> {
  await requireRole("OWNER");

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nama produk wajib diisi." };
  if (!Number.isFinite(input.price) || input.price < 0) return { ok: false, error: "Harga tidak valid." };

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) return { ok: false, error: "Kategori tidak ditemukan." };

  // Renaming/repricing here never touches OrderItem — those already
  // snapshot productName/unitPrice at sale time (CLAUDE.md "Order & status"),
  // so history never changes retroactively.
  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { name, price: Math.round(input.price), categoryId: input.categoryId },
    }),
    prisma.productAddonGroup.deleteMany({ where: { productId } }),
    ...(input.addonGroupIds.length > 0
      ? [
          prisma.productAddonGroup.createMany({
            data: input.addonGroupIds.map((addonGroupId, i) => ({ productId, addonGroupId, sortOrder: i })),
          }),
        ]
      : []),
  ]);

  return { ok: true };
}

// Soft delete only (CLAUDE.md "Lain-lain": products use isActive, never hard
// delete — old orders keep referencing the row forever). Reactivating is
// the same action with the opposite value.
export async function setProductActive(productId: string, isActive: boolean): Promise<ActionResult> {
  await requireRole("OWNER");
  const result = await prisma.product.updateMany({ where: { id: productId }, data: { isActive } });
  if (result.count === 0) return { ok: false, error: "Produk tidak ditemukan." };
  return { ok: true };
}

export type CreateAddonOptionInput = { addonGroupId: string; name: string; price: number };

export async function createAddonOption(input: CreateAddonOptionInput): Promise<ActionResult> {
  await requireRole("OWNER");

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nama add-on wajib diisi." };
  if (!Number.isFinite(input.price)) return { ok: false, error: "Harga tidak valid." };

  const group = await prisma.addonGroup.findUnique({ where: { id: input.addonGroupId } });
  if (!group) return { ok: false, error: "Grup add-on tidak ditemukan." };

  const last = await prisma.addonOption.findFirst({
    where: { addonGroupId: input.addonGroupId },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  await prisma.addonOption.create({
    data: { addonGroupId: input.addonGroupId, name, price: Math.round(input.price), sortOrder },
  });

  return { ok: true };
}

export type UpdateAddonOptionInput = { name: string; price: number };

export async function updateAddonOption(optionId: string, input: UpdateAddonOptionInput): Promise<ActionResult> {
  await requireRole("OWNER");

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nama add-on wajib diisi." };
  if (!Number.isFinite(input.price)) return { ok: false, error: "Harga tidak valid." };

  const result = await prisma.addonOption.updateMany({
    where: { id: optionId },
    data: { name, price: Math.round(input.price) },
  });
  if (result.count === 0) return { ok: false, error: "Add-on tidak ditemukan." };
  return { ok: true };
}

export async function setAddonOptionActive(optionId: string, isActive: boolean): Promise<ActionResult> {
  await requireRole("OWNER");
  const result = await prisma.addonOption.updateMany({ where: { id: optionId }, data: { isActive } });
  if (result.count === 0) return { ok: false, error: "Add-on tidak ditemukan." };
  return { ok: true };
}

// "Perkiraan Bakso Terpakai" (Dashboard) — the 12 owner-editable ball
// counts behind that estimate (CLAUDE.md, 24 Sep 2026; schema.prisma's
// BaksoUsageSetting doc comment). Singleton row, same update shape as the
// admin Setting form.
export type BaksoUsageSettingInput = {
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

export async function updateBaksoUsageSetting(input: BaksoUsageSettingInput): Promise<ActionResult> {
  await requireRole("OWNER");

  const entries = Object.entries(input) as [keyof BaksoUsageSettingInput, number][];
  for (const [key, value] of entries) {
    if (!Number.isFinite(value) || value < 0) return { ok: false, error: `Angka "${key}" tidak valid.` };
  }

  const rounded = Object.fromEntries(entries.map(([key, value]) => [key, Math.round(value)])) as BaksoUsageSettingInput;
  await prisma.baksoUsageSetting.update({ where: { id: "singleton" }, data: rounded });
  return { ok: true };
}
