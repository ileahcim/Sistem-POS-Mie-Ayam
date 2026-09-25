import { prisma } from "@/lib/prisma";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "@/lib/orders/pricing";
import { localDateStr, localTimeStr } from "@/lib/timezone";
import { PAYMENT_METHOD_LABEL } from "@/lib/orders/payment-method-label";

export type ExportTransactionRow = {
  orderNumber: number;
  tanggal: string;
  jam: string;
  channel: string;
  meja: string;
  namaPelanggan: string;
  metodeBayar: string;
  // Only non-zero for a SPLIT order — see CLAUDE.md-worthy brief "Split
  // payment", 22 Sep 2026.
  splitCashAmount: number;
  splitQrisAmount: number;
  subtotal: number;
  ongkir: number;
  total: number;
};

// Unbounded on purpose — this is a full export, not the dashboard's capped
// "recent view" (see get-shift-history.ts / get-omzet-history.ts for those).
export async function getAllPaidTransactions(): Promise<ExportTransactionRow[]> {
  const orders = await prisma.order.findMany({
    where: { status: "PAID" },
    include: { items: true },
    orderBy: { paidAt: "asc" },
  });

  return orders.map((order) => {
    const subtotal = order.items.reduce((sum, i) => sum + i.lineTotal, 0);
    const ongkir =
      order.channel === "ANTAR"
        ? order.items.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) * DELIVERY_FEE_PER_FOOD_ITEM
        : 0;
    const paidAt = order.paidAt ?? order.createdAt;
    return {
      orderNumber: order.orderNumber,
      tanggal: localDateStr(paidAt),
      jam: localTimeStr(paidAt),
      channel: order.channel,
      meja: order.tableLabel ?? "",
      namaPelanggan: order.customerName ?? "",
      metodeBayar: order.paymentMethod ? PAYMENT_METHOD_LABEL[order.paymentMethod] : "",
      splitCashAmount: order.splitCashAmount ?? 0,
      splitQrisAmount: order.splitQrisAmount ?? 0,
      subtotal,
      ongkir,
      total: subtotal + ongkir,
    };
  });
}

export type ExportShiftRow = {
  tanggalBuka: string;
  jamBuka: string;
  jamTutup: string;
  kasir: string;
  openingCash: number;
  cashSales: number;
  nonCashSales: number;
  expenseTotal: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  depositsAppliedCash: number;
  depositsReceivedCash: number;
  depositRefundsCash: number;
  forfeitedDeposits: number;
  receivableSettledCash: number;
  receivableSettledNonCash: number;
  receivablePocketCash: number;
};

// All closed shifts — the frozen numbers, same rule as the dashboard.
export async function getAllClosedShifts(): Promise<ExportShiftRow[]> {
  const shifts = await prisma.shift.findMany({
    where: { status: "CLOSED" },
    orderBy: { openedAt: "asc" },
    include: { openedBy: true },
  });

  return shifts.map((s) => ({
    tanggalBuka: localDateStr(s.openedAt),
    jamBuka: localTimeStr(s.openedAt),
    jamTutup: localTimeStr(s.closedAt ?? s.openedAt),
    kasir: s.openedBy.name,
    openingCash: s.openingCash,
    cashSales: s.cashSales ?? 0,
    nonCashSales: s.nonCashSales ?? 0,
    expenseTotal: s.expenseTotal ?? 0,
    expectedCash: s.expectedCash ?? 0,
    countedCash: s.countedCash ?? 0,
    difference: s.difference ?? 0,
    depositsAppliedCash: s.depositsAppliedCash ?? 0,
    depositsReceivedCash: s.depositsReceivedCash ?? 0,
    depositRefundsCash: s.depositRefundsCash ?? 0,
    forfeitedDeposits: s.forfeitedDeposits ?? 0,
    receivableSettledCash: s.receivableSettledCash ?? 0,
    receivableSettledNonCash: s.receivableSettledNonCash ?? 0,
    receivablePocketCash: s.receivablePocketCash ?? 0,
  }));
}
