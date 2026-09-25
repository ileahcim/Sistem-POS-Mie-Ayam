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

// THE one way an order becomes a piutang — used by Tutup Shift ("Tandai
// Piutang") and by the Pembayaran screen's "Belum Bayar" (25 Sep 2026), so
// there is no second piutang path. A piutang is not a sale: closeShift only
// sums PAID, so it stays out of the drawer and omzet until it is settled —
// and then it counts in the shift open at settlement (payOrder).
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

  // The order leaves the till now, exactly like a paid one: its food is
  // considered handed over (no longer on Order Aktif either way — RECEIVABLE
  // is not an active status), an earlier servedAt is never overwritten.
  const servedAt = order.servedAt ?? new Date();
  // Guarded by status and "still no DP", so a payment or DP on another
  // device a moment ago makes this match nothing instead of overwriting it.
  const guard = { id: orderId, status: "OPEN" as const, deposits: { none: {} } };
  const raced = { ok: false as const, error: "Order ini baru saja berubah. Muat ulang layar lalu coba lagi." };

  if (order.shiftId == null) {
    // A pre-order (Pesanan Terjadwal) has no shift/queue number until it is
    // settled at the till — attach them now, atomically, to the shift open
    // at this moment, same as payOrder does when a pre-order is paid. That
    // shift is the one whose Tutup Shift lists it under "Piutang dari shift
    // ini".
    const openShift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
    if (!openShift) return { ok: false, error: "Belum ada shift terbuka. Buka shift dulu." };
    const done = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.update({ where: { id: openShift.id }, data: { lastQueueNumber: { increment: 1 } } });
      const claimed = await tx.order.updateMany({
        where: guard,
        data: {
          status: "RECEIVABLE",
          customerName: customerName.trim(),
          shiftId: shift.id,
          queueNumber: shift.lastQueueNumber,
          servedAt,
        },
      });
      if (claimed.count !== 1) throw new ReceivableRaced();
      return true;
    }).catch((e) => {
      if (e instanceof ReceivableRaced) return false;
      throw e;
    });
    return done ? { ok: true } : raced;
  }

  const claimed = await prisma.order.updateMany({
    where: guard,
    data: { status: "RECEIVABLE", customerName: customerName.trim(), servedAt },
  });
  return claimed.count === 1 ? { ok: true } : raced;
}

class ReceivableRaced extends Error {}

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
      receivableSettledCash: number;
      receivableSettledNonCash: number;
      receivablePocketCash: number;
    }
  | { ok: false; error: string };

// `acknowledgedReceivableIds`: the piutang of this shift the cashier ticked
// "sudah dicatat" on the Tutup Shift checklist. A piutang doesn't block the
// close (it may be paid days later) but it must never be forgotten, so every
// one of them has to be acknowledged — checked here, not just on screen.
export async function closeShift(countedCash: number, acknowledgedReceivableIds: string[] = []): Promise<CloseShiftResult> {
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

  const receivables = await prisma.order.findMany({ where: { shiftId: shift.id, status: "RECEIVABLE" }, select: { id: true } });
  const acknowledged = new Set(acknowledgedReceivableIds);
  if (receivables.some((r) => !acknowledged.has(r.id))) {
    return { ok: false, error: "Ada piutang shift ini yang belum dicentang. Muat ulang layar lalu cek daftar piutangnya." };
  }

  // Sales of this shift: orders paid in it — except a piutang settled in some
  // OTHER shift, whose sale belongs to that shift — plus every piutang settled
  // in it, whichever shift it was created in (settledShiftId).
  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PAID",
      OR: [{ shiftId: shift.id, settledShiftId: null }, { settledShiftId: shift.id }],
    },
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
      // Only a QRIS settlement leaves settlementCashToDrawer null; its cash
      // slice is 0 then, so the default doesn't matter.
      settledReceivable: o.settledShiftId ? { cashToDrawer: o.settlementCashToDrawer ?? true } : null,
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
      receivableSettledCash: closing.receivableSettledCash,
      receivableSettledNonCash: closing.receivableSettledNonCash,
      receivablePocketCash: closing.receivablePocketCash,
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
    receivableSettledCash: closing.receivableSettledCash,
    receivableSettledNonCash: closing.receivableSettledNonCash,
    receivablePocketCash: closing.receivablePocketCash,
  };
}
