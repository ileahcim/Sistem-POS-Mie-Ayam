"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";
import { localDateStr, wibDateRange } from "@/lib/timezone";
import type { MieProductType } from "@/lib/mie/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
  customLabel: string;
  kg: number;
  pricePerKg: number;
  date: string; // ISO instant, already resolved to the device's local midnight client-side
  note: string;
};

export async function createMieOrder(input: CreateMieOrderInput): Promise<ActionResult> {
  const user = await requireRole("OWNER");

  const customer = await prisma.mieCustomer.findUnique({ where: { id: input.customerId } });
  if (!customer || !customer.isActive) return { ok: false, error: "Pelanggan tidak ditemukan." };

  if (input.productType === "CUSTOM" && !input.customLabel.trim()) {
    return { ok: false, error: "Isi nama jenis mi untuk pesanan custom." };
  }
  if (!Number.isFinite(input.kg) || input.kg <= 0) return { ok: false, error: "Jumlah kg tidak valid." };
  if (!Number.isFinite(input.pricePerKg) || input.pricePerKg <= 0) {
    return { ok: false, error: "Harga per kg tidak valid." };
  }
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };

  await prisma.mieLedgerEntry.create({
    data: {
      customerId: input.customerId,
      kind: "ORDER",
      productType: input.productType,
      customLabel: input.productType === "CUSTOM" ? input.customLabel.trim() : null,
      kg: input.kg,
      pricePerKg: input.pricePerKg,
      amount: Math.round(input.kg * input.pricePerKg),
      date,
      note: input.note.trim() || null,
      createdById: user.id,
    },
  });

  return { ok: true };
}

export type CreateMiePaymentInput = {
  customerId: string;
  amount: number;
  date: string;
  note: string;
};

export async function createMiePayment(input: CreateMiePaymentInput): Promise<ActionResult> {
  const user = await requireRole("OWNER");

  const customer = await prisma.mieCustomer.findUnique({ where: { id: input.customerId } });
  if (!customer || !customer.isActive) return { ok: false, error: "Pelanggan tidak ditemukan." };

  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: "Nominal tidak valid." };
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Tanggal tidak valid." };

  await prisma.mieLedgerEntry.create({
    data: {
      customerId: input.customerId,
      kind: "PAYMENT",
      amount: Math.round(input.amount),
      date,
      note: input.note.trim() || null,
      createdById: user.id,
    },
  });

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
    where: { customerId, kind: "ORDER", productType },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { pricePerKg: true },
  });
  if (lastOrder?.pricePerKg != null) return lastOrder.pricePerKg;

  const productDefault = await prisma.mieProductDefault.findUnique({ where: { productType } });
  return productDefault?.defaultPricePerKg ?? null;
}
