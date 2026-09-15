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

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paymentMethod: method,
      paidAt: new Date(),
      cashTendered,
      changeGiven,
    },
  });

  const [paidOrder, settings] = await Promise.all([getOrderDetail(order.id), getSettings()]);
  const receipt = buildReceiptData(paidOrder!, settings);

  return { ok: true, receipt };
}
