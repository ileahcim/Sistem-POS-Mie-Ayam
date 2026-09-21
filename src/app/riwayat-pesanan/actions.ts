"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Void — for an order that is already PAID (money already went into the
// drawer / QRIS). OWNER only, reason required (CLAUDE.md "Order & status").
// Distinct from Batalkan Order (cancelOrder), which is for unpaid orders.
//
// Effect on cash reconciliation: closeShift() only ever sums status PAID,
// so a void before the shift closes drops out of cashSales/expectedCash
// automatically (the cash is expected to be handed back from the drawer).
// A shift that is already CLOSED keeps its frozen numbers untouched — see
// CLAUDE.md "Shift & kas". The status check lives in the update's WHERE so
// two concurrent voids can't both succeed.
export async function voidPaidOrder(orderId: string, reason: string): Promise<ActionResult> {
  const user = await requireRole("OWNER");

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Isi alasan void." };

  // Not yet supported for an order that used DP: the DP was settled into a
  // shift that may already be closed, and un-settling it would need its own
  // refund/forfeit step to keep the drawer honest. Refused rather than guessed.
  const result = await prisma.order.updateMany({
    where: { id: orderId, status: "PAID", deposits: { none: {} } },
    data: { status: "VOID", voidReason: trimmed, voidedById: user.id, voidedAt: new Date() },
  });
  if (result.count === 0) {
    if ((await prisma.preorderDeposit.count({ where: { orderId } })) > 0) {
      return {
        ok: false,
        error: "Void belum didukung untuk order yang memakai DP, supaya kas shift tetap akurat. Hubungi pengembang.",
      };
    }
    return { ok: false, error: "Hanya order yang sudah dibayar yang bisa di-void." };
  }
  return { ok: true };
}
