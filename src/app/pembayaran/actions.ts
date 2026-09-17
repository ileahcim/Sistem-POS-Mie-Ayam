"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/get-current-user";
import { getOrderDetail } from "@/lib/orders/get-order-detail";
import { buildReceiptData } from "@/lib/orders/build-receipt-data";
import { getSettings } from "@/lib/settings/get-settings";
import type { ReceiptData } from "@/lib/printing/types";

export type PaymentMethod = "CASH" | "QRIS" | "TRANSFER";

export type PayOrderResult =
  | { ok: true; receipt: ReceiptData }
  | { ok: false; error: string };

// Total is always recomputed server-side from the order's own snapshotted
// items (getOrderDetail) — never trust a total the client displayed, since
// prices could only be stale/tampered by then, not fresher. Printing must
// happen client-side (see printing module), so this returns the built
// ReceiptData for the caller to hand straight to getPrinter().printReceipt().
export async function payOrder(
  orderId: string,
  method: PaymentMethod,
  cashTendered: number | null,
): Promise<PayOrderResult> {
  await requireUser();

  const order = await getOrderDetail(orderId);
  if (!order) return { ok: false, error: "Order tidak ditemukan." };
  // RECEIVABLE is payable too — that's a piutang being settled later, not a
  // dead end. Only PAID (already done) and VOID (cancelled) block payment.
  if (order.status !== "OPEN" && order.status !== "RECEIVABLE") {
    return { ok: false, error: "Order ini sudah tidak bisa dibayar (sudah lunas/void)." };
  }

  if (cashTendered != null && cashTendered < order.total) {
    return { ok: false, error: "Uang tendered kurang dari total." };
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

    await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.update({
        where: { id: openShift.id },
        data: { lastQueueNumber: { increment: 1 } },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          shiftId: shift.id,
          queueNumber: shift.lastQueueNumber,
          status: "PAID",
          paymentMethod: method,
          paidAt,
          servedAt,
          cashTendered,
          changeGiven,
        },
      });
    });
  } else {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentMethod: method,
        paidAt,
        servedAt,
        cashTendered,
        changeGiven,
      },
    });
  }

  const [paidOrder, settings] = await Promise.all([getOrderDetail(order.id), getSettings()]);
  const receipt = buildReceiptData(paidOrder!, settings);

  return { ok: true, receipt };
}
