import { prisma } from "@/lib/prisma";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "@/lib/orders/pricing";

export type OpenShift = {
  id: string;
  openedAt: string;
  openingCash: number;
  openedByName: string;
};

export async function getOpenShift(): Promise<OpenShift | null> {
  const shift = await prisma.shift.findFirst({
    where: { status: "OPEN" },
    include: { openedBy: true },
  });
  if (!shift) return null;
  return {
    id: shift.id,
    openedAt: shift.openedAt.toISOString(),
    openingCash: shift.openingCash,
    openedByName: shift.openedBy.name,
  };
}

export type UnpaidOrderForClose = {
  id: string;
  queueNumber: number | null;
  queueSuffix: string;
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  customerName: string | null;
  total: number;
};

// Orders that block a shift close: anything not yet resolved to PAID,
// CANCELLED, or RECEIVABLE. Total is recomputed the same way get-order-detail does
// (subtotal + Antar delivery fee) so the close screen shows real amounts.
export async function getUnpaidOrdersForShift(shiftId: string): Promise<UnpaidOrderForClose[]> {
  return ordersForClose(shiftId, "OPEN");
}

// Piutang created in this shift and still unpaid — "Belum Bayar" at the till,
// or ones just marked in this same Tutup Shift. They don't block the close
// (payment may come days later), but each must be ticked "sudah dicatat" on
// the checklist (closeShift re-checks the ids).
export async function getReceivablesForShift(shiftId: string): Promise<UnpaidOrderForClose[]> {
  return ordersForClose(shiftId, "RECEIVABLE");
}

async function ordersForClose(shiftId: string, status: "OPEN" | "RECEIVABLE"): Promise<UnpaidOrderForClose[]> {
  const orders = await prisma.order.findMany({
    where: { shiftId, status },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  return orders.map((order) => {
    const subtotal = order.items.reduce((sum, i) => sum + i.lineTotal, 0);
    const deliveryFee =
      order.channel === "ANTAR"
        ? order.items.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) *
          DELIVERY_FEE_PER_FOOD_ITEM
        : 0;
    return {
      id: order.id,
      queueNumber: order.queueNumber,
      queueSuffix: order.queueSuffix,
      channel: order.channel,
      tableLabel: order.tableLabel,
      customerName: order.customerName,
      total: subtotal + deliveryFee,
    };
  });
}

export type ShiftExpense = {
  id: string;
  description: string;
  amount: number;
};

export async function getShiftExpenses(shiftId: string): Promise<ShiftExpense[]> {
  const expenses = await prisma.expense.findMany({
    where: { shiftId },
    orderBy: { createdAt: "asc" },
  });
  return expenses.map((e) => ({ id: e.id, description: e.description, amount: e.amount }));
}
