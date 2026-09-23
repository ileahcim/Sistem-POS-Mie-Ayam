"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/get-current-user";
import { orderTotalFromLines } from "@/lib/orders/order-total";
import { computeShiftClosing } from "@/lib/deposits/shift-math";
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

export type AddExpenseResult = { ok: true; id: string } | { ok: false; error: string };

export async function addExpense(description: string, amount: number): Promise<AddExpenseResult> {
  const user = await requireUser();

  if (!description.trim()) return { ok: false, error: "Isi keterangan pengeluaran." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Nominal tidak valid." };

  const shift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
  if (!shift) return { ok: false, error: "Tidak ada shift terbuka." };

  const expense = await prisma.expense.create({
    data: { shiftId: shift.id, description: description.trim(), amount, createdById: user.id },
  });
  return { ok: true, id: expense.id };
}

// Undoing a mis-typed Pengeluaran (wrong amount, duplicate entry). Only
// while its shift is still OPEN — a closed shift's expenseTotal is frozen
// (CLAUDE.md "Shift & kas": numbers from a closed shift never recompute),
// so deleting a row underneath it would make the frozen total a lie.
export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  await requireUser();

  const result = await prisma.expense.deleteMany({
    where: { id: expenseId, shift: { status: "OPEN" } },
  });
  if (result.count === 0) {
    return { ok: false, error: "Pengeluaran tidak ditemukan, atau shift-nya sudah ditutup." };
  }
  return { ok: true };
}

export async function markOrderReceivable(orderId: string, customerName: string): Promise<ActionResult> {
  await requireUser();

  if (!customerName.trim()) return { ok: false, error: "Isi nama untuk piutang." };

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { deposits: { select: { id: true } } } });
  if (!order || order.status !== "OPEN") return { ok: false, error: "Order tidak valid." };
  // DP is money already received against this order; it must be settled
  // (paid, refunded or forfeited), never parked as a piutang.
  if (order.deposits.length > 0) {
    return { ok: false, error: "Order ini punya DP — tidak bisa dijadikan piutang." };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "RECEIVABLE", customerName: customerName.trim() },
  });
  return { ok: true };
}

export type CloseShiftResult =
  | {
      ok: true;
      openingCash: number;
      cashSales: number;
      nonCashSales: number;
      expenseTotal: number;
      expectedCash: number;
      countedCash: number;
      difference: number;
      // Pre-order DP — the rows that make expectedCash traceable (see
      // lib/deposits/shift-math.ts). All 0 on a day without DP.
      depositsAppliedCash: number;
      depositsReceivedCash: number;
      depositsReceivedNonCash: number;
      depositRefundsCash: number;
      depositRefundsNonCash: number;
      forfeitedDeposits: number;
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
    include: { items: true, deposits: { where: { kind: "APPLIED" } } },
  });
  // Every DP movement stamped with THIS shift: cash DP taken, refunds paid out,
  // DP forfeited. (DP applied to an order is read off the order itself above.)
  const depositEntries = await prisma.preorderDeposit.findMany({ where: { shiftId: shift.id } });

  const expenses = await prisma.expense.findMany({ where: { shiftId: shift.id } });
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Sales stay the FULL value of every order paid today; only the DRAWER math
  // knows about DP. With no DP anywhere this is exactly the old formula
  // (openingCash + cashSales - expenseTotal) — see lib/deposits/shift-math.ts.
  const closing = computeShiftClosing({
    openingCash: shift.openingCash,
    paidOrders: paidOrders.map((o) => ({
      total: orderTotalFromLines(o.items, o.channel),
      method: o.paymentMethod,
      depositsApplied: o.deposits.reduce((sum, d) => sum + d.amount, 0),
      splitQrisAmount: o.splitQrisAmount,
    })),
    expenseTotal,
    // DP itself is never SPLIT — only the sale that settles it can be
    // (validateDeposit restricts recordDeposit to CASH/QRIS, TRANSFER legacy).
    depositEntries: depositEntries.map((e) => ({
      kind: e.kind,
      method: e.method as "CASH" | "QRIS" | "TRANSFER",
      amount: e.amount,
    })),
  });
  const { cashSales, nonCashSales, expectedCash } = closing;
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
      depositsAppliedCash: closing.depositsAppliedCash,
      depositsReceivedCash: closing.depositsReceivedCash,
      depositsReceivedNonCash: closing.depositsReceivedNonCash,
      depositRefundsCash: closing.depositRefundsCash,
      depositRefundsNonCash: closing.depositRefundsNonCash,
      forfeitedDeposits: closing.forfeitedDeposits,
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

  return {
    ok: true,
    openingCash: shift.openingCash,
    cashSales,
    nonCashSales,
    expenseTotal,
    expectedCash,
    countedCash,
    difference,
    depositsAppliedCash: closing.depositsAppliedCash,
    depositsReceivedCash: closing.depositsReceivedCash,
    depositsReceivedNonCash: closing.depositsReceivedNonCash,
    depositRefundsCash: closing.depositRefundsCash,
    depositRefundsNonCash: closing.depositRefundsNonCash,
    forfeitedDeposits: closing.forfeitedDeposits,
  };
}
