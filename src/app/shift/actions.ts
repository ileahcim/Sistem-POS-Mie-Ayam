"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth/get-current-user";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "@/lib/orders/pricing";
import { refreshComboCache } from "@/lib/combo/refresh-combo-cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function openShift(openingCash: number): Promise<ActionResult> {
  const user = await requireUser();

  if (!Number.isFinite(openingCash) || openingCash < 0) {
    return { ok: false, error: "Modal awal tidak valid." };
  }

  const existing = await prisma.shift.findFirst({ where: { status: "OPEN" } });
  if (existing) return { ok: false, error: "Sudah ada shift yang terbuka." };

  await prisma.shift.create({ data: { openedById: user.id, openingCash } });
  return { ok: true };
}

export async function addExpense(description: string, amount: number): Promise<ActionResult> {
  const user = await requireUser();

  if (!description.trim()) return { ok: false, error: "Isi keterangan pengeluaran." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Nominal tidak valid." };

  const shift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
  if (!shift) return { ok: false, error: "Tidak ada shift terbuka." };

  await prisma.expense.create({
    data: { shiftId: shift.id, description: description.trim(), amount, createdById: user.id },
  });
  return { ok: true };
}

// "Batalkan" during shift close — a void, so it follows the same rule as
// any other void: reason required, OWNER only.
export async function voidUnpaidOrder(orderId: string, reason: string): Promise<ActionResult> {
  const user = await requireRole("OWNER");

  if (!reason.trim()) return { ok: false, error: "Isi alasan pembatalan." };

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "OPEN") return { ok: false, error: "Order tidak valid." };

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "VOID", voidReason: reason.trim(), voidedById: user.id, voidedAt: new Date() },
  });
  return { ok: true };
}

export async function markOrderReceivable(orderId: string, customerName: string): Promise<ActionResult> {
  await requireUser();

  if (!customerName.trim()) return { ok: false, error: "Isi nama untuk piutang." };

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "OPEN") return { ok: false, error: "Order tidak valid." };

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "RECEIVABLE", customerName: customerName.trim() },
  });
  return { ok: true };
}

export type CloseShiftResult =
  | {
      ok: true;
      cashSales: number;
      nonCashSales: number;
      expenseTotal: number;
      expectedCash: number;
      countedCash: number;
      difference: number;
    }
  | { ok: false; error: string };

export async function closeShift(countedCash: number): Promise<CloseShiftResult> {
  const user = await requireUser();

  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return { ok: false, error: "Hitungan uang fisik tidak valid." };
  }

  const shift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
  if (!shift) return { ok: false, error: "Tidak ada shift terbuka." };

  const unresolvedCount = await prisma.order.count({ where: { shiftId: shift.id, status: "OPEN" } });
  if (unresolvedCount > 0) {
    return { ok: false, error: "Masih ada order belum selesai — batalkan atau tandai piutang dulu." };
  }

  const paidOrders = await prisma.order.findMany({
    where: { shiftId: shift.id, status: "PAID" },
    include: { items: true },
  });

  function orderTotal(order: (typeof paidOrders)[number]) {
    const subtotal = order.items.reduce((sum, i) => sum + i.lineTotal, 0);
    const deliveryFee =
      order.channel === "ANTAR"
        ? order.items.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) *
          DELIVERY_FEE_PER_FOOD_ITEM
        : 0;
    return subtotal + deliveryFee;
  }

  const cashSales = paidOrders
    .filter((o) => o.paymentMethod === "CASH")
    .reduce((sum, o) => sum + orderTotal(o), 0);
  const nonCashSales = paidOrders
    .filter((o) => o.paymentMethod === "QRIS" || o.paymentMethod === "TRANSFER")
    .reduce((sum, o) => sum + orderTotal(o), 0);

  const expenses = await prisma.expense.findMany({ where: { shiftId: shift.id } });
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const expectedCash = shift.openingCash + cashSales - expenseTotal;
  const difference = countedCash - expectedCash;

  await prisma.shift.update({
    where: { id: shift.id },
    data: {
      status: "CLOSED",
      closedById: user.id,
      closedAt: new Date(),
      cashSales,
      nonCashSales,
      expenseTotal,
      expectedCash,
      countedCash,
      difference,
    },
  });

  // Menu populer: rolling 30-day aggregation, refreshed once a day right
  // here (never real-time) — see CLAUDE.md "Menu populer". Never let a
  // failure here block the shift from actually closing; it's a cash
  // reconciliation event, not a business-intelligence one.
  try {
    await refreshComboCache();
  } catch (e) {
    console.error("refreshComboCache failed after shift close:", e);
  }

  return { ok: true, cashSales, nonCashSales, expenseTotal, expectedCash, countedCash, difference };
}
