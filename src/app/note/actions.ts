"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";
import { localDateStr, wibDateRange } from "@/lib/timezone";
import type { MieAdjustmentKind, MieCostKey, MieProductType } from "@/lib/mie/types";
import {
  isNotePaymentMethod,
  resolveNotePaymentMethodEdit,
  type NotePaymentMethod,
} from "@/lib/note/payment-method";

export type ActionResult = { ok: true } | { ok: false; error: string };
// A new order/payment row: its id lets the Hari Ini tab highlight it.
export type CreateMieEntryResult = { ok: true; entryId: string } | { ok: false; error: string };

export async function createMieCustomer(
  name: string,
  note: string,
  initialBalance: number,
): Promise<ActionResult & { customerId?: string }> {
  const user = await requireRole("OWNER");

  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Nama pelanggan wajib diisi." };
  if (!Number.isFinite(initialBalance) || initialBalance < 0) {
    return { ok: false, error: "Saldo awal tidak valid." };
  }

  const customer = await prisma.mieCustomer.create({
    data: {
      name: trimmedName,
      note: note.trim() || null,
      // The opening balance is itself a ledger row, not a stored column —
      // same rule as every other balance in this module (see schema.prisma).
      // Dated at today's WIB midnight (not the literal creation instant) so
      // it always sorts before same-day orders/payments, which the new-
      // order/new-payment forms also default to today at local midnight —
      // a raw `new Date()` here would carry today's time-of-day and could
      // sort AFTER a same-day order dated at 00:00, corrupting the running-
      // balance column's row order (see CLAUDE.md "Zona waktu").
      entries:
        initialBalance > 0
          ? {
              create: [
                {
                  kind: "OPENING_BALANCE",
                  amount: Math.round(initialBalance),
                  date: wibDateRange(localDateStr(new Date())).start,
                  note: "Saldo awal saat pelanggan didaftarkan",
                  createdById: user.id,
                },
              ],
            }
          : undefined,
    },
  });

  return { ok: true, customerId: customer.id };
}

export type CreateMieOrderInput = {
  customerId: string;
  productType: MieProductType;
  isPasar: boolean; // tapped "Mi Pasar" — only valid with MIE_KERITING
  customLabel: string;
  kg: number;
  pricePerKg: number;
  date: string; // ISO instant, already resolved to the device's local midnight client-side
  note: string;
};

const MIE_PRODUCT_TYPES: MieProductType[] = ["MIE_KERITING", "MIE_LURUS", "PANGSIT", "CUSTOM"];

// One rule for "which jenis is this order", shared by create and edit:
// a known jenis, "Mi Pasar" only on Mi Keriting (Lurus/Pangsit have no pasar
// variant), and a name for CUSTOM.
function validateJenis(
  productType: MieProductType,
  isPasar: boolean,
  customLabel: string,
): { ok: true; data: { productType: MieProductType; isPasar: boolean; customLabel: string | null } } | { ok: false; error: string } {
  if (!MIE_PRODUCT_TYPES.includes(productType)) return { ok: false, error: "Jenis mi tidak valid." };
  if (isPasar && productType !== "MIE_KERITING") return { ok: false, error: "Mi Pasar hanya untuk Mi Keriting." };
  if (productType === "CUSTOM" && !customLabel.trim()) {
    return { ok: false, error: "Isi nama jenis mi untuk pesanan custom." };
  }
  return {
    ok: true,
    data: {
      productType,
      isPasar: productType === "MIE_KERITING" && isPasar === true,
      customLabel: productType === "CUSTOM" ? customLabel.trim() : null,
    },
  };
}

export async function createMieOrder(input: CreateMieOrderInput): Promise<CreateMieEntryResult> {
  const user = await requireRole("OWNER");

  const customer = await prisma.mieCustomer.findUnique({ where: { id: input.customerId } });
  if (!customer || !customer.isActive) return { ok: false, error: "Pelanggan tidak ditemukan." };

  const jenis = validateJenis(input.productType, input.isPasar, input.customLabel);
  if (!jenis.ok) return jenis;
  if (!Number.isFinite(input.kg) || input.kg <= 0) return { ok: false, error: "Jumlah kg tidak valid." };
  if (!Number.isFinite(input.pricePerKg) || input.pricePerKg <= 0) {
    return { ok: false, error: "Harga per kg tidak valid." };
  }
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };

  const entry = await prisma.mieLedgerEntry.create({
    data: {
      customerId: input.customerId,
      kind: "ORDER",
      ...jenis.data,
      kg: input.kg,
      pricePerKg: input.pricePerKg,
      amount: Math.round(input.kg * input.pricePerKg),
      date,
      note: input.note.trim() || null,
      createdById: user.id,
    },
  });

  return { ok: true, entryId: entry.id };
}

export type CreateMiePaymentInput = {
  customerId: string;
  amount: number;
  paymentMethod: NotePaymentMethod;
  date: string;
  note: string;
};

export async function createMiePayment(input: CreateMiePaymentInput): Promise<CreateMieEntryResult> {
  const user = await requireRole("OWNER");

  const customer = await prisma.mieCustomer.findUnique({ where: { id: input.customerId } });
  if (!customer || !customer.isActive) return { ok: false, error: "Pelanggan tidak ditemukan." };

  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: "Nominal tidak valid." };
  // Required for NEW payments only — rows recorded before this column
  // existed keep their honest NULL (see schema.prisma).
  if (!isNotePaymentMethod(input.paymentMethod)) {
    return { ok: false, error: "Pilih metode pembayaran (Cash atau QRIS)." };
  }
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };

  const entry = await prisma.mieLedgerEntry.create({
    data: {
      customerId: input.customerId,
      kind: "PAYMENT",
      amount: Math.round(input.amount),
      paymentMethod: input.paymentMethod,
      date,
      note: input.note.trim() || null,
      createdById: user.id,
    },
  });

  return { ok: true, entryId: entry.id };
}

// ---------------------------------------------------------------------------
// Customer edit / nonaktif / hapus
// ---------------------------------------------------------------------------

export async function updateMieCustomer(customerId: string, name: string, note: string): Promise<ActionResult> {
  await requireRole("OWNER");

  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Nama pelanggan wajib diisi." };

  const result = await prisma.mieCustomer.updateMany({
    where: { id: customerId },
    data: { name: trimmedName, note: note.trim() || null },
  });
  if (result.count === 0) return { ok: false, error: "Pelanggan tidak ditemukan." };
  return { ok: true };
}

// Soft delete (and back) — the ledger rows stay exactly as they are, since
// the balance is computed from them. A nonaktif customer drops off the main
// list and the new-order/new-payment pickers, but its page still opens.
export async function setMieCustomerActive(customerId: string, isActive: boolean): Promise<ActionResult> {
  await requireRole("OWNER");

  const result = await prisma.mieCustomer.updateMany({ where: { id: customerId }, data: { isActive } });
  if (result.count === 0) return { ok: false, error: "Pelanggan tidak ditemukan." };
  return { ok: true };
}

// Permanent delete is only allowed for a customer with zero ledger rows
// (created by mistake, nothing recorded yet). Checked inside the same
// transaction as the delete so a row added concurrently can't be orphaned.
export async function deleteMieCustomer(customerId: string): Promise<ActionResult> {
  await requireRole("OWNER");

  return prisma.$transaction(async (tx) => {
    const entryCount = await tx.mieLedgerEntry.count({ where: { customerId } });
    if (entryCount > 0) {
      return {
        ok: false as const,
        error: "Pelanggan ini sudah punya riwayat transaksi — tidak bisa dihapus permanen. Nonaktifkan saja.",
      };
    }
    const result = await tx.mieCustomer.deleteMany({ where: { id: customerId } });
    if (result.count === 0) return { ok: false as const, error: "Pelanggan tidak ditemukan." };
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// Koreksi saldo — always a NEW ledger row, never an edit of an old one
// ---------------------------------------------------------------------------

export type CreateMieAdjustmentInput = {
  customerId: string;
  kind: MieAdjustmentKind;
  amount: number;
  date: string; // ISO instant, device-local midnight (same as the order/payment forms)
  note: string;
};

const ADJUSTMENT_KINDS: MieAdjustmentKind[] = ["OPENING_BALANCE", "CORRECTION_ADD", "CORRECTION_SUBTRACT"];

export async function createMieAdjustment(input: CreateMieAdjustmentInput): Promise<ActionResult> {
  const user = await requireRole("OWNER");

  if (!ADJUSTMENT_KINDS.includes(input.kind)) return { ok: false, error: "Jenis koreksi tidak valid." };
  const customer = await prisma.mieCustomer.findUnique({ where: { id: input.customerId } });
  if (!customer || !customer.isActive) return { ok: false, error: "Pelanggan tidak ditemukan atau nonaktif." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: "Nominal tidak valid." };
  // A correction must say why — it's the only trail explaining the row.
  if (input.kind !== "OPENING_BALANCE" && !input.note.trim()) {
    return { ok: false, error: "Tulis keterangan koreksinya." };
  }
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };

  await prisma.mieLedgerEntry.create({
    data: {
      customerId: input.customerId,
      kind: input.kind,
      amount: Math.round(input.amount),
      date,
      note: input.note.trim() || null,
      createdById: user.id,
    },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Edit / hapus a ledger row. Every running balance after it simply
// recomputes on the next read (balance is always a sum over rows).
// ---------------------------------------------------------------------------

export type UpdateMieEntryInput = {
  kg?: number; // ORDER only
  pricePerKg?: number; // ORDER only
  // ORDER only, all three together — the jenis (fix a wrong tap, or a row
  // the pasar backfill marked wrongly). Omitted = jenis unchanged.
  jenis?: { productType: MieProductType; isPasar: boolean; customLabel: string };
  amount?: number; // non-ORDER only — an ORDER's amount is always kg × price
  // PAYMENT only. `null` means "leave it unrecorded", which is only allowed
  // while the row has never had a method — see the rule in updateMieEntry.
  paymentMethod?: NotePaymentMethod | null;
  date: string;
  note: string;
};

export async function updateMieEntry(entryId: string, input: UpdateMieEntryInput): Promise<ActionResult> {
  await requireRole("OWNER");

  const entry = await prisma.mieLedgerEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { ok: false, error: "Transaksi tidak ditemukan." };

  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };
  const note = input.note.trim() || null;

  if (entry.kind === "ORDER") {
    const kg = Number(input.kg);
    const pricePerKg = Number(input.pricePerKg);
    if (!Number.isFinite(kg) || kg <= 0) return { ok: false, error: "Jumlah kg tidak valid." };
    if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return { ok: false, error: "Harga per kg tidak valid." };
    let jenisData = {};
    if (input.jenis) {
      const jenis = validateJenis(input.jenis.productType, input.jenis.isPasar, input.jenis.customLabel);
      if (!jenis.ok) return jenis;
      jenisData = jenis.data;
    }
    await prisma.mieLedgerEntry.update({
      where: { id: entryId },
      data: { ...jenisData, kg, pricePerKg: Math.round(pricePerKg), amount: Math.round(kg * pricePerKg), date, note },
    });
    return { ok: true };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Nominal tidak valid." };
  if ((entry.kind === "CORRECTION_ADD" || entry.kind === "CORRECTION_SUBTRACT") && !note) {
    return { ok: false, error: "Keterangan koreksi tidak boleh kosong." };
  }

  // Payment method, PAYMENT rows only. An old row whose method was never
  // recorded may stay that way (we refuse to invent one), or be filled in
  // if the owner still remembers — but a method that IS recorded can only
  // be switched between Cash and QRIS, never erased back to unknown, since
  // that would destroy a fact rather than correct one.
  const paymentMethod = resolveNotePaymentMethodEdit(
    entry.kind === "PAYMENT",
    entry.paymentMethod,
    input.paymentMethod,
  );
  if (!paymentMethod.ok) return paymentMethod;

  await prisma.mieLedgerEntry.update({
    where: { id: entryId },
    data: { amount: Math.round(amount), date, note, ...paymentMethod.data },
  });
  return { ok: true };
}

export async function deleteMieEntry(entryId: string): Promise<ActionResult> {
  await requireRole("OWNER");

  const result = await prisma.mieLedgerEntry.deleteMany({ where: { id: entryId } });
  if (result.count === 0) return { ok: false, error: "Transaksi tidak ditemukan." };
  return { ok: true };
}

export async function updateMieProductDefault(
  productType: Exclude<MieProductType, "CUSTOM">,
  defaultPricePerKg: number,
): Promise<ActionResult> {
  await requireRole("OWNER");

  if (!Number.isFinite(defaultPricePerKg) || defaultPricePerKg <= 0) {
    return { ok: false, error: "Harga tidak valid." };
  }

  await prisma.mieProductDefault.upsert({
    where: { productType },
    update: { defaultPricePerKg: Math.round(defaultPricePerKg) },
    create: { productType, defaultPricePerKg: Math.round(defaultPricePerKg) },
  });

  return { ok: true };
}

export async function updateMiePasarPrice(pricePerKg: number): Promise<ActionResult> {
  await requireRole("OWNER");

  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
    return { ok: false, error: "Harga tidak valid." };
  }

  await prisma.mieSetting.upsert({
    where: { id: "singleton" },
    update: { pasarPricePerKg: Math.round(pricePerKg) },
    create: { id: "singleton", pasarPricePerKg: Math.round(pricePerKg) },
  });

  return { ok: true };
}

// Modal per kg (Reguler per jenis, or Mi Pasar) — see MieCostKey. Only a
// positive number is accepted; there is no "clear back to belum diisi".
export async function updateMieCostPerKg(key: MieCostKey, costPerKg: number): Promise<ActionResult> {
  await requireRole("OWNER");

  if (!Number.isFinite(costPerKg) || costPerKg <= 0) return { ok: false, error: "Modal tidak valid." };
  const value = Math.round(costPerKg);

  if (key === "MIE_PASAR") {
    await prisma.mieSetting.upsert({
      where: { id: "singleton" },
      update: { pasarCostPerKg: value },
      create: { id: "singleton", pasarCostPerKg: value },
    });
    return { ok: true };
  }
  if (key !== "MIE_KERITING" && key !== "MIE_LURUS" && key !== "PANGSIT") {
    return { ok: false, error: "Jenis mi tidak valid." };
  }
  await prisma.mieProductDefault.upsert({
    where: { productType: key },
    update: { costPerKg: value },
    create: { productType: key, costPerKg: value },
  });
  return { ok: true };
}

// Price autofill for the new-order form: this customer's last price for
// this exact product if they've ordered it before, else the product's
// owner-set default (see get-mie-product-defaults.ts) — never for CUSTOM,
// which is always priced fresh (see CLAUDE.md-worthy brief).
export async function getMieAutofillPrice(
  customerId: string,
  productType: Exclude<MieProductType, "CUSTOM">,
): Promise<number | null> {
  await requireRole("OWNER");

  const lastOrder = await prisma.mieLedgerEntry.findFirst({
    // Pasar orders are priced from their own shortcut, not this customer's
    // regular price — never let one leak into the other's autofill.
    where: { customerId, kind: "ORDER", productType, isPasar: false },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { pricePerKg: true },
  });
  if (lastOrder?.pricePerKg != null) return lastOrder.pricePerKg;

  const productDefault = await prisma.mieProductDefault.findUnique({ where: { productType } });
  return productDefault?.defaultPricePerKg ?? null;
}
