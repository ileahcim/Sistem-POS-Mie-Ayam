"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";
import { localDateStr, wibDateRange } from "@/lib/timezone";
import { frozenEntrySignedAmount, type FrozenAdjustmentKind } from "@/lib/frozen/types";
import {
  isNotePaymentMethod,
  resolveNotePaymentMethodEdit,
  type NotePaymentMethod,
} from "@/lib/note/payment-method";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function currentBalance(customerId: string): Promise<number> {
  const entries = await prisma.frozenLedgerEntry.findMany({
    where: { customerId },
    select: { kind: true, amount: true },
  });
  return entries.reduce((sum, e) => sum + frozenEntrySignedAmount(e), 0);
}

export async function createFrozenCustomer(
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

  const customer = await prisma.frozenCustomer.create({
    data: {
      name: trimmedName,
      note: note.trim() || null,
      // Dated at today's WIB midnight, same reasoning as createMieCustomer
      // (CLAUDE.md "Zona waktu") — sorts before any same-day pickup/payment.
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

export type CreateFrozenOrderInput = {
  customerId: string;
  pcs: number;
  pricePerPcs: number;
  date: string; // ISO instant, already resolved to the device's local midnight client-side
  note: string;
};

export type CreateFrozenOrderResult =
  | {
      ok: true;
      entryId: string; // lets the Hari Ini tab highlight the new row
      customerName: string;
      pcs: number;
      pricePerPcs: number;
      amount: number;
      debtAfter: number;
      // Server instant, for the print prompt's "Jam" line — never the
      // client device's own clock (see CLAUDE.md "Zona waktu").
      recordedAt: string;
    }
  | { ok: false; error: string };

// "Pengambilan" — pcs taken, priced per pcs, snapshotted at pickup time (see
// FrozenLedgerEntry.pricePerPcs's doc comment). Returns everything the
// caller needs to offer a "Cetak bukti?" print immediately, without a
// second round-trip (same pattern as payOrder returning `receipt`).
export async function createFrozenOrder(input: CreateFrozenOrderInput): Promise<CreateFrozenOrderResult> {
  const user = await requireRole("OWNER");

  const customer = await prisma.frozenCustomer.findUnique({ where: { id: input.customerId } });
  if (!customer || !customer.isActive) return { ok: false, error: "Pelanggan tidak ditemukan." };

  if (!Number.isInteger(input.pcs) || input.pcs <= 0) return { ok: false, error: "Jumlah pcs tidak valid." };
  if (!Number.isFinite(input.pricePerPcs) || input.pricePerPcs <= 0) {
    return { ok: false, error: "Harga per pcs tidak valid." };
  }
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };

  const amount = Math.round(input.pcs * input.pricePerPcs);
  const entry = await prisma.frozenLedgerEntry.create({
    data: {
      customerId: input.customerId,
      kind: "ORDER",
      pcs: input.pcs,
      pricePerPcs: Math.round(input.pricePerPcs),
      amount,
      date,
      note: input.note.trim() || null,
      createdById: user.id,
    },
  });

  const debtAfter = await currentBalance(input.customerId);
  return {
    ok: true,
    entryId: entry.id,
    customerName: customer.name,
    pcs: input.pcs,
    pricePerPcs: Math.round(input.pricePerPcs),
    amount,
    debtAfter,
    recordedAt: new Date().toISOString(),
  };
}

export type CreateFrozenPaymentInput = {
  customerId: string;
  amount: number;
  paymentMethod: NotePaymentMethod;
  date: string;
  note: string;
};

export type CreateFrozenPaymentResult =
  | { ok: true; entryId: string; customerName: string; amountPaid: number; debtAfter: number; recordedAt: string }
  | { ok: false; error: string };

export async function createFrozenPayment(input: CreateFrozenPaymentInput): Promise<CreateFrozenPaymentResult> {
  const user = await requireRole("OWNER");

  const customer = await prisma.frozenCustomer.findUnique({ where: { id: input.customerId } });
  if (!customer || !customer.isActive) return { ok: false, error: "Pelanggan tidak ditemukan." };

  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: "Nominal tidak valid." };
  // Required for NEW payments only — see createMiePayment / schema.prisma.
  if (!isNotePaymentMethod(input.paymentMethod)) {
    return { ok: false, error: "Pilih metode pembayaran (Cash atau QRIS)." };
  }
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };

  const amountPaid = Math.round(input.amount);
  const entry = await prisma.frozenLedgerEntry.create({
    data: {
      customerId: input.customerId,
      kind: "PAYMENT",
      amount: amountPaid,
      paymentMethod: input.paymentMethod,
      date,
      note: input.note.trim() || null,
      createdById: user.id,
    },
  });

  const debtAfter = await currentBalance(input.customerId);
  return { ok: true, entryId: entry.id, customerName: customer.name, amountPaid, debtAfter, recordedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Customer edit / nonaktif / hapus — mirrors note/actions.ts exactly.
// ---------------------------------------------------------------------------

export async function updateFrozenCustomer(customerId: string, name: string, note: string): Promise<ActionResult> {
  await requireRole("OWNER");

  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Nama pelanggan wajib diisi." };

  const result = await prisma.frozenCustomer.updateMany({
    where: { id: customerId },
    data: { name: trimmedName, note: note.trim() || null },
  });
  if (result.count === 0) return { ok: false, error: "Pelanggan tidak ditemukan." };
  return { ok: true };
}

export async function setFrozenCustomerActive(customerId: string, isActive: boolean): Promise<ActionResult> {
  await requireRole("OWNER");

  const result = await prisma.frozenCustomer.updateMany({ where: { id: customerId }, data: { isActive } });
  if (result.count === 0) return { ok: false, error: "Pelanggan tidak ditemukan." };
  return { ok: true };
}

export async function deleteFrozenCustomer(customerId: string): Promise<ActionResult> {
  await requireRole("OWNER");

  return prisma.$transaction(async (tx) => {
    const entryCount = await tx.frozenLedgerEntry.count({ where: { customerId } });
    if (entryCount > 0) {
      return {
        ok: false as const,
        error: "Pelanggan ini sudah punya riwayat transaksi — tidak bisa dihapus permanen. Nonaktifkan saja.",
      };
    }
    const result = await tx.frozenCustomer.deleteMany({ where: { id: customerId } });
    if (result.count === 0) return { ok: false as const, error: "Pelanggan tidak ditemukan." };
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// Koreksi saldo — always a NEW ledger row, never an edit of an old one.
// ---------------------------------------------------------------------------

export type CreateFrozenAdjustmentInput = {
  customerId: string;
  kind: FrozenAdjustmentKind;
  amount: number;
  date: string;
  note: string;
};

const ADJUSTMENT_KINDS: FrozenAdjustmentKind[] = ["OPENING_BALANCE", "CORRECTION_ADD", "CORRECTION_SUBTRACT"];

export async function createFrozenAdjustment(input: CreateFrozenAdjustmentInput): Promise<ActionResult> {
  const user = await requireRole("OWNER");

  if (!ADJUSTMENT_KINDS.includes(input.kind)) return { ok: false, error: "Jenis koreksi tidak valid." };
  const customer = await prisma.frozenCustomer.findUnique({ where: { id: input.customerId } });
  if (!customer || !customer.isActive) return { ok: false, error: "Pelanggan tidak ditemukan atau nonaktif." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: "Nominal tidak valid." };
  if (input.kind !== "OPENING_BALANCE" && !input.note.trim()) {
    return { ok: false, error: "Tulis keterangan koreksinya." };
  }
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };

  await prisma.frozenLedgerEntry.create({
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
// Edit / hapus a ledger row.
// ---------------------------------------------------------------------------

export type UpdateFrozenEntryInput = {
  pcs?: number; // ORDER only
  pricePerPcs?: number; // ORDER only
  amount?: number; // non-ORDER only
  paymentMethod?: NotePaymentMethod | null; // PAYMENT only — see updateMieEntry
  date: string;
  note: string;
};

export async function updateFrozenEntry(entryId: string, input: UpdateFrozenEntryInput): Promise<ActionResult> {
  await requireRole("OWNER");

  const entry = await prisma.frozenLedgerEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { ok: false, error: "Transaksi tidak ditemukan." };

  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };
  const note = input.note.trim() || null;

  if (entry.kind === "ORDER") {
    const pcs = Number(input.pcs);
    const pricePerPcs = Number(input.pricePerPcs);
    if (!Number.isInteger(pcs) || pcs <= 0) return { ok: false, error: "Jumlah pcs tidak valid." };
    if (!Number.isFinite(pricePerPcs) || pricePerPcs <= 0) return { ok: false, error: "Harga per pcs tidak valid." };
    await prisma.frozenLedgerEntry.update({
      where: { id: entryId },
      data: { pcs, pricePerPcs: Math.round(pricePerPcs), amount: Math.round(pcs * pricePerPcs), date, note },
    });
    return { ok: true };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Nominal tidak valid." };
  if ((entry.kind === "CORRECTION_ADD" || entry.kind === "CORRECTION_SUBTRACT") && !note) {
    return { ok: false, error: "Keterangan koreksi tidak boleh kosong." };
  }

  // Same single rule as Mi Mentah — see resolveNotePaymentMethodEdit.
  const paymentMethod = resolveNotePaymentMethodEdit(
    entry.kind === "PAYMENT",
    entry.paymentMethod,
    input.paymentMethod,
  );
  if (!paymentMethod.ok) return paymentMethod;

  await prisma.frozenLedgerEntry.update({
    where: { id: entryId },
    data: { amount: Math.round(amount), date, note, ...paymentMethod.data },
  });
  return { ok: true };
}

export async function deleteFrozenEntry(entryId: string): Promise<ActionResult> {
  await requireRole("OWNER");

  const result = await prisma.frozenLedgerEntry.deleteMany({ where: { id: entryId } });
  if (result.count === 0) return { ok: false, error: "Transaksi tidak ditemukan." };
  return { ok: true };
}

export async function updateFrozenPrice(pricePerPcs: number): Promise<ActionResult> {
  await requireRole("OWNER");

  if (!Number.isFinite(pricePerPcs) || pricePerPcs <= 0) {
    return { ok: false, error: "Harga tidak valid." };
  }

  await prisma.mieSetting.upsert({
    where: { id: "singleton" },
    update: { frozenPricePerPcs: Math.round(pricePerPcs) },
    create: { id: "singleton", frozenPricePerPcs: Math.round(pricePerPcs) },
  });

  return { ok: true };
}

// Price autofill for the pickup form: this customer's last pricePerPcs if
// they've had a pickup before, else the buku's owner-set default. There is
// no per-product-type default table here — only one product.
export async function getFrozenAutofillPrice(customerId: string): Promise<number | null> {
  await requireRole("OWNER");

  const lastOrder = await prisma.frozenLedgerEntry.findFirst({
    where: { customerId, kind: "ORDER" },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { pricePerPcs: true },
  });
  if (lastOrder?.pricePerPcs != null) return lastOrder.pricePerPcs;

  const setting = await prisma.mieSetting.findUnique({ where: { id: "singleton" } });
  return setting?.frozenPricePerPcs ?? null;
}
