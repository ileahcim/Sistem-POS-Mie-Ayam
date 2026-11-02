"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth/get-current-user";
import { changeStock, StockError } from "@/lib/stock/apply";
import { ICE_CREAM_CATEGORY_NAME, unitCostFromBox } from "@/lib/stock/types";

// Stok Es Krim (docs/spec-es-krim.md). Every stock change goes through
// changeStock inside a transaction, which also writes its StockMovement row.
// None of these touch Shift/Order/Expense: restock, corrections and "Ambil
// Sendiri" are never a sale and never in the drawer.

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_PCS = 10_000; // sanity bound on one entry, not a business rule

function isPositiveInt(n: number, max = MAX_PCS): boolean {
  return Number.isInteger(n) && n > 0 && n <= max;
}

function cleanText(s: string | null | undefined, max = 100): string | null {
  const t = (s ?? "").trim().slice(0, max);
  return t || null;
}

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: e.message };
    throw e;
  }
}

// "Ambil Sendiri" — family took ice cream from the freezer, not a sale.
// Any logged-in user (owner's brief: OWNER & CASHIER). Name is optional.
export async function recordSelfUse(input: { productId: string; qty: number; takenBy: string }): Promise<ActionResult> {
  const user = await requireUser();
  if (!isPositiveInt(input.qty, 1000)) return { ok: false, error: "Jumlah tidak valid." };
  return run(() =>
    prisma.$transaction(async (tx) => {
      await changeStock(tx, {
        productId: input.productId,
        delta: -input.qty,
        kind: "SELF_USE",
        takenBy: cleanText(input.takenBy, 60),
        userId: user.id,
      });
    }),
  );
}

// "Barang Masuk" — boxes bought from the distributor. Stock += boxes × isi,
// and the product's modal per pcs follows the latest box price (owner's
// brief), so Dashboard margin uses what the newest stock actually cost.
// OWNER only.
export async function recordRestock(input: {
  productId: string;
  boxes: number;
  unitsPerBox: number;
  boxPrice: number;
}): Promise<ActionResult> {
  const user = await requireRole("OWNER");
  if (!isPositiveInt(input.boxes, 1000)) return { ok: false, error: "Jumlah box tidak valid." };
  if (!isPositiveInt(input.unitsPerBox, 1000)) return { ok: false, error: "Isi per box tidak valid." };
  if (!isPositiveInt(input.boxPrice, 100_000_000)) return { ok: false, error: "Harga per box tidak valid." };

  return run(() =>
    prisma.$transaction(async (tx) => {
      const updated = await tx.product.updateMany({
        where: { id: input.productId, tracksStock: true },
        data: {
          unitsPerBox: input.unitsPerBox,
          boxPrice: input.boxPrice,
          costPrice: unitCostFromBox(input.boxPrice, input.unitsPerBox),
          costPriceEstimated: false,
        },
      });
      if (updated.count === 0) throw new StockError("Produk es krim tidak ditemukan.");
      await changeStock(tx, {
        productId: input.productId,
        delta: input.boxes * input.unitsPerBox,
        kind: "RESTOCK",
        boxes: input.boxes,
        unitsPerBox: input.unitsPerBox,
        boxPrice: input.boxPrice,
        userId: user.id,
      });
    }),
  );
}

// "Koreksi Stok" — manual +/− with a required reason (rusak, meleleh, salah
// hitung…). Kept apart from SELF_USE so the family's share never hides in
// corrections. OWNER only.
export async function recordCorrection(input: { productId: string; delta: number; reason: string }): Promise<ActionResult> {
  const user = await requireRole("OWNER");
  const reason = cleanText(input.reason);
  if (!reason) return { ok: false, error: "Isi alasan koreksi." };
  if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > MAX_PCS) {
    return { ok: false, error: "Jumlah koreksi tidak valid." };
  }
  return run(() =>
    prisma.$transaction(async (tx) => {
      await changeStock(tx, { productId: input.productId, delta: input.delta, kind: "CORRECTION", note: reason, userId: user.id });
    }),
  );
}

export type IceCreamProductInput = { name: string; price: number; unitsPerBox: number; boxPrice: number };

function validateProduct(input: IceCreamProductInput): string | null {
  if (!input.name.trim()) return "Nama wajib diisi.";
  if (!isPositiveInt(input.price, 10_000_000)) return "Harga jual tidak valid.";
  if (!isPositiveInt(input.unitsPerBox, 1000)) return "Isi per box tidak valid.";
  if (!isPositiveInt(input.boxPrice, 100_000_000)) return "Harga beli per box tidak valid.";
  return null;
}

// New es krim product, stock 0 — stock only ever arrives through Barang Masuk,
// so the very first pcs also has a history row. OWNER only.
export async function createIceCreamProduct(input: IceCreamProductInput): Promise<ActionResult> {
  await requireRole("OWNER");
  const problem = validateProduct(input);
  if (problem) return { ok: false, error: problem };

  const category = await prisma.category.findUnique({ where: { name: ICE_CREAM_CATEGORY_NAME } });
  if (!category) return { ok: false, error: "Kategori Es Krim tidak ditemukan — hubungi pengembang." };
  const last = await prisma.product.findFirst({ where: { categoryId: category.id }, orderBy: { sortOrder: "desc" } });

  await prisma.product.create({
    data: {
      categoryId: category.id,
      name: input.name.trim(),
      price: input.price,
      unitsPerBox: input.unitsPerBox,
      boxPrice: input.boxPrice,
      costPrice: unitCostFromBox(input.boxPrice, input.unitsPerBox),
      tracksStock: true,
      stock: 0,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return { ok: true };
}

// Name/price/box info. Never touches stock (that is Barang Masuk / Koreksi)
// and never rewrites old orders — those snapshot name/price/cost. OWNER only.
export async function updateIceCreamProduct(productId: string, input: IceCreamProductInput): Promise<ActionResult> {
  await requireRole("OWNER");
  const problem = validateProduct(input);
  if (problem) return { ok: false, error: problem };

  const updated = await prisma.product.updateMany({
    where: { id: productId, tracksStock: true },
    data: {
      name: input.name.trim(),
      price: input.price,
      unitsPerBox: input.unitsPerBox,
      boxPrice: input.boxPrice,
      costPrice: unitCostFromBox(input.boxPrice, input.unitsPerBox),
      costPriceEstimated: false,
    },
  });
  if (updated.count === 0) return { ok: false, error: "Produk es krim tidak ditemukan." };
  return { ok: true };
}

// Soft delete only (CLAUDE.md "Lain-lain"). Hidden from Kasir; history and
// old orders stay. OWNER only.
export async function setIceCreamActive(productId: string, isActive: boolean): Promise<ActionResult> {
  await requireRole("OWNER");
  const updated = await prisma.product.updateMany({ where: { id: productId, tracksStock: true }, data: { isActive } });
  if (updated.count === 0) return { ok: false, error: "Produk es krim tidak ditemukan." };
  return { ok: true };
}
