"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/get-current-user";
import { getOrderDetail, type OrderDetail } from "@/lib/orders/get-order-detail";
import { buildReceiptData } from "@/lib/orders/build-receipt-data";
import { orderTotalFromLines } from "@/lib/orders/order-total";
import { allocateDeposits, methodWhenFullyPrepaid, type DepositMethod } from "@/lib/deposits/settle";
import { validateSplitCashAmount } from "@/lib/orders/validate-split-payment";
import { getSettings } from "@/lib/settings/get-settings";
import type { ReceiptData } from "@/lib/printing/types";
import { markOrderReceivable } from "@/app/shift/actions";

export type PaymentMethod = "CASH" | "QRIS" | "TRANSFER" | "SPLIT";

export type PayOrderResult =
  | { ok: true; receipt: ReceiptData }
  | { ok: false; error: string };

// Thrown inside a transaction to roll it back with a message the cashier can read.
class PaymentRefused extends Error {}

// The ordinary and DP payment paths only ever claim an OPEN order; a
// RECEIVABLE one is settled by settleReceivable, which stamps the settling
// shift — an order that turned into a piutang a moment ago must not slip
// through here without it.
const PAYABLE = ["OPEN"] as const;
const RACED =
  "Order ini baru saja berubah (sudah dibayar, atau baru dicatat DP di perangkat lain). Muat ulang layar lalu coba lagi.";

// Total is always recomputed server-side from the order's own snapshotted
// items (getOrderDetail) — never trust a total the client displayed, since
// prices could only be stale/tampered by then, not fresher. Printing must
// happen client-side (see printing module), so this returns the built
// ReceiptData for the caller to hand straight to getPrinter().printReceipt().
export async function payOrder(
  orderId: string,
  method: PaymentMethod,
  cashTendered: number | null,
  // Only meaningful when method === "SPLIT": the cash slice the cashier
  // typed. QRIS slice is always derived server-side (order.total - this),
  // never trusted from the client.
  splitCashAmount: number | null = null,
  // Settling a piutang only: where the cash slice of a Cash / Cash+QRIS
  // settlement went — true "masuk laci", false "masuk kantong". Required
  // then, ignored otherwise.
  cashToDrawer: boolean | null = null,
): Promise<PayOrderResult> {
  const user = await requireUser();

  const order = await getOrderDetail(orderId);
  if (!order) return { ok: false, error: "Order tidak ditemukan." };
  // RECEIVABLE is payable too — that's a piutang being settled later, not a
  // dead end, and it has its own path (settleReceivable). Only PAID (already
  // done), VOID and CANCELLED block payment.
  if (order.status === "RECEIVABLE") return settleReceivable(order, method, splitCashAmount, cashToDrawer);
  if (order.status !== "OPEN") {
    return { ok: false, error: "Order ini sudah tidak bisa dibayar (sudah lunas/void)." };
  }

  // A pre-order that took DP settles in its own transaction: only the remainder
  // is collected, and the DP is applied (or the excess handed back) in the same
  // commit. Everything below is the ordinary path, untouched by DP.
  if (order.deposits.length > 0) {
    return payWithDeposits(order, user.id, method, cashTendered, splitCashAmount);
  }

  if (cashTendered != null && cashTendered < order.total) {
    return { ok: false, error: "Uang tendered kurang dari total." };
  }
  let splitQrisAmount: number | null = null;
  if (method === "SPLIT") {
    const error = validateSplitCashAmount(splitCashAmount ?? NaN, order.total);
    if (error) return { ok: false, error };
    splitQrisAmount = order.total - (splitCashAmount as number);
  }

  const changeGiven = cashTendered != null ? cashTendered - order.total : null;

  // Bungkus/Antar: the customer usually pays first and then waits, so once
  // it's paid the cashier's part is done — it's marked served right here
  // instead of needing a separate "Sudah Disajikan" tap to leave Order
  // Aktif. Dine In keeps the two independent steps (food usually comes out
  // before payment there). An earlier manual servedAt is never overwritten.
  const paidAt = new Date();
  const servedAt = order.servedAt ? undefined : order.channel !== "DINE_IN" ? paidAt : undefined;

  if (order.shiftId == null) {
    // Pre-order being paid for the first time — see CLAUDE.md "Pre-order".
    // shiftId/queueNumber are attached now, atomically, to whichever shift
    // is open at this exact moment (the delivery day's shift, not the day
    // it was phoned in), same increment pattern saveOrder() uses.
    const openShift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
    if (!openShift) {
      return { ok: false, error: "Belum ada shift terbuka. Buka shift dulu sebelum membayar pre-order ini." };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const shift = await tx.shift.update({
          where: { id: openShift.id },
          data: { lastQueueNumber: { increment: 1 } },
        });
        // Guarded by status and by "still no DP": a second tap on Bayar, or a DP
        // recorded on another device a moment ago, makes this match nothing and
        // rolls the queue-number increment back with it.
        const claimed = await tx.order.updateMany({
          where: { id: order.id, status: { in: [...PAYABLE] }, deposits: { none: {} } },
          data: {
            shiftId: shift.id,
            queueNumber: shift.lastQueueNumber,
            status: "PAID",
            paymentMethod: method,
            paidAt,
            servedAt,
            cashTendered,
            changeGiven,
            splitCashAmount: method === "SPLIT" ? splitCashAmount : null,
            splitQrisAmount,
          },
        });
        if (claimed.count !== 1) throw new PaymentRefused(RACED);
      });
    } catch (e) {
      if (e instanceof PaymentRefused) return { ok: false, error: e.message };
      throw e;
    }
  } else {
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, status: { in: [...PAYABLE] }, deposits: { none: {} } },
      data: {
        status: "PAID",
        paymentMethod: method,
        paidAt,
        servedAt,
        cashTendered,
        changeGiven,
        splitCashAmount: method === "SPLIT" ? splitCashAmount : null,
        splitQrisAmount,
      },
    });
    if (claimed.count !== 1) return { ok: false, error: RACED };
  }

  const [paidOrder, settings] = await Promise.all([getOrderDetail(order.id), getSettings()]);
  const receipt = buildReceiptData(paidOrder!, settings);

  return { ok: true, receipt };
}

// Settling a piutang (RECEIVABLE). Its sale is counted in the shift open NOW
// (settledShiftId), not the one it was created in — that one may have closed
// days ago with the piutang correctly left out. The order keeps its own
// shiftId/queue number. A piutang never holds DP (markOrderReceivable refuses
// one), so this never meets payWithDeposits.
async function settleReceivable(
  order: OrderDetail,
  method: PaymentMethod,
  splitCashAmount: number | null,
  cashToDrawer: boolean | null,
): Promise<PayOrderResult> {
  if (method !== "CASH" && method !== "QRIS" && method !== "SPLIT") return { ok: false, error: "Metode bayar tidak valid." };
  const cashLike = method === "CASH" || method === "SPLIT";
  if (cashLike && typeof cashToDrawer !== "boolean") {
    return { ok: false, error: "Pilih uang tunainya masuk laci atau masuk kantong." };
  }
  let splitQrisAmount: number | null = null;
  if (method === "SPLIT") {
    const error = validateSplitCashAmount(splitCashAmount ?? NaN, order.total);
    if (error) return { ok: false, error };
    splitQrisAmount = order.total - (splitCashAmount as number);
  }

  const openShift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
  if (!openShift) return { ok: false, error: "Belum ada shift terbuka. Buka shift dulu sebelum melunasi piutang." };

  const claimed = await prisma.order.updateMany({
    where: { id: order.id, status: "RECEIVABLE" },
    data: {
      status: "PAID",
      paymentMethod: method,
      paidAt: new Date(),
      cashTendered: null,
      changeGiven: null,
      splitCashAmount: method === "SPLIT" ? splitCashAmount : null,
      splitQrisAmount,
      settledShiftId: openShift.id,
      settlementCashToDrawer: cashLike ? cashToDrawer : null,
    },
  });
  if (claimed.count !== 1) return { ok: false, error: RACED };

  const [paidOrder, settings] = await Promise.all([getOrderDetail(order.id), getSettings()]);
  return { ok: true, receipt: buildReceiptData(paidOrder!, settings) };
}

// "Belum Bayar" on the Pembayaran screen: the customer will pay later, and
// the cashier knows it now. Goes through markOrderReceivable — the very same
// piutang path Tutup Shift uses, no second one — then hands back a
// "BELUM LUNAS" struk (buildReceiptData on a RECEIVABLE order).
export async function payLater(orderId: string, customerName: string): Promise<PayOrderResult> {
  await requireUser();
  const marked = await markOrderReceivable(orderId, customerName);
  if (!marked.ok) return marked;
  const [order, settings] = await Promise.all([getOrderDetail(orderId), getSettings()]);
  return { ok: true, receipt: buildReceiptData(order!, settings) };
}

// Paying a pre-order that holds DP. Only the REMAINDER is collected now; the DP
// is applied against the sale, and if the order shrank below the DP the excess
// is handed back — each as ledger rows stamped with THIS shift, which is what
// lets closeShift keep the drawer honest (see lib/deposits/shift-math.ts).
//
// The whole thing is one transaction that starts by locking the order row, and
// everything (items, total, ledger) is re-read after the lock — so a double tap,
// or an item removed or a DP recorded on another device a moment ago, can neither
// settle the DP twice nor settle it against a stale total.
async function payWithDeposits(
  order: OrderDetail,
  userId: string,
  method: PaymentMethod,
  cashTendered: number | null,
  splitCashAmount: number | null,
): Promise<PayOrderResult> {
  const paidAt = new Date();
  const servedAt = order.servedAt ? undefined : order.channel !== "DINE_IN" ? paidAt : undefined;

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.order.updateMany({
        where: { id: order.id, status: { in: [...PAYABLE] } },
        data: { updatedAt: new Date() },
      });
      if (locked.count !== 1) {
        throw new PaymentRefused("Order ini sudah tidak bisa dibayar (sudah lunas/void).");
      }

      const fresh = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, deposits: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
      });
      const total = orderTotalFromLines(fresh.items, fresh.channel);
      const received = fresh.deposits
        .filter((d) => d.kind === "RECEIVED")
        .map((d) => ({ id: d.id, method: d.method as DepositMethod, amount: d.amount }));
      const allocation = allocateDeposits(total, received);

      if (cashTendered != null && cashTendered < allocation.remainder) {
        throw new PaymentRefused("Uang tendered kurang dari sisa yang harus dibayar.");
      }
      const changeGiven = cashTendered != null ? cashTendered - allocation.remainder : null;
      // Nothing left to collect: the DP paid for it all, so there is no method
      // to choose at the till — label the order after the DP that covered it.
      const paymentMethod = allocation.remainder === 0 ? methodWhenFullyPrepaid(allocation.applied) : method;

      // Split applies to the SISA only (what's actually collected now), never
      // to the DP itself — the DP's own rule is untouched (see shift-math.ts).
      let splitQrisAmount: number | null = null;
      if (paymentMethod === "SPLIT" && allocation.remainder > 0) {
        const error = validateSplitCashAmount(splitCashAmount ?? NaN, allocation.remainder);
        if (error) throw new PaymentRefused(error);
        splitQrisAmount = allocation.remainder - (splitCashAmount as number);
      }

      // Same rule as any pre-order: it is attached to the shift open NOW, the
      // delivery day's, not the day it was phoned in.
      let shiftId = fresh.shiftId;
      let queueNumber = fresh.queueNumber;
      if (shiftId == null) {
        const openShift = await tx.shift.findFirst({ where: { status: "OPEN" } });
        if (!openShift) {
          throw new PaymentRefused("Belum ada shift terbuka. Buka shift dulu sebelum membayar pre-order ini.");
        }
        const shift = await tx.shift.update({
          where: { id: openShift.id },
          data: { lastQueueNumber: { increment: 1 } },
        });
        shiftId = shift.id;
        queueNumber = shift.lastQueueNumber;
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          shiftId,
          queueNumber,
          status: "PAID",
          paymentMethod,
          paidAt,
          servedAt,
          cashTendered,
          changeGiven,
          splitCashAmount: paymentMethod === "SPLIT" ? splitCashAmount : null,
          splitQrisAmount,
        },
      });

      const settlement = [
        ...allocation.applied.map((slice) => ({ kind: "APPLIED" as const, method: slice.method, amount: slice.amount })),
        ...allocation.refunded.map((slice) => ({ kind: "REFUNDED" as const, method: slice.method, amount: slice.amount })),
      ];
      if (settlement.length > 0) {
        await tx.preorderDeposit.createMany({
          data: settlement.map((entry) => ({ ...entry, orderId: order.id, shiftId, createdById: userId })),
        });
      }
    });
  } catch (e) {
    if (e instanceof PaymentRefused) return { ok: false, error: e.message };
    throw e;
  }

  const [paidOrder, settings] = await Promise.all([getOrderDetail(order.id), getSettings()]);
  return { ok: true, receipt: buildReceiptData(paidOrder!, settings) };
}
