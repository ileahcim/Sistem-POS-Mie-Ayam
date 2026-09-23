"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";
import { orderTotalFromLines } from "@/lib/orders/order-total";
import { validateSplitCashAmount } from "@/lib/orders/validate-split-payment";
import type { ChangeablePaymentMethod } from "@/lib/orders/payment-method-label";

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

// Corrects a mis-tapped payment method on an already-PAID order (e.g. Cash
// tapped instead of QRIS) without voiding it — CLAUDE.md "Ubah Metode
// Bayar", 24 Sep 2026. OWNER only, reason required, and every change is
// logged as its own PaymentMethodChange row (never overwritten in place),
// same spirit as Void's own reason/who/when trail.
export async function changePaymentMethod(
  orderId: string,
  toMethod: ChangeablePaymentMethod,
  // Only meaningful when toMethod === "SPLIT" — the cash slice; QRIS slice
  // is always derived server-side, never trusted from the client (same rule
  // as payOrder).
  toCashAmount: number | null,
  reason: string,
): Promise<ActionResult> {
  const user = await requireRole("OWNER");

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Isi alasan perubahan." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { select: { lineTotal: true, qty: true, isDeliveryChargeable: true } },
      shift: { select: { status: true } },
      deposits: { where: { kind: "RECEIVED" }, select: { amount: true } },
    },
  });
  if (!order) return { ok: false, error: "Order tidak ditemukan." };
  if (order.status !== "PAID") {
    return { ok: false, error: "Hanya order yang sudah dibayar yang bisa diubah metode bayarnya." };
  }
  // Shift numbers are frozen at close (CLAUDE.md "Shift & kas") — changing
  // the method after that would make the shift's Penjualan Cash/QRIS no
  // longer match what was actually reported.
  if (order.shift && order.shift.status === "CLOSED") {
    return {
      ok: false,
      error: "Shift order ini sudah ditutup — metode bayar tidak bisa diubah lagi karena angka shift itu sudah beku.",
    };
  }

  // What THIS payment actually collected: the order's total minus any DP
  // already applied before it — same math as OrderDetail.amountDue
  // (depositPosition), recomputed fresh here rather than trusted from the
  // client. Zero for an order fully covered by DP (nothing was collected at
  // the till, so a SPLIT target is correctly refused below by
  // validateSplitCashAmount having no room to fit into).
  const total = orderTotalFromLines(order.items, order.channel);
  const depositHeld = order.deposits.reduce((sum, d) => sum + d.amount, 0);
  const amountCharged = Math.max(0, total - depositHeld);

  let toQrisAmount: number | null = null;
  if (toMethod === "SPLIT") {
    const error = validateSplitCashAmount(toCashAmount ?? NaN, amountCharged);
    if (error) return { ok: false, error };
    toQrisAmount = amountCharged - (toCashAmount as number);
  }

  const unchanged =
    order.paymentMethod === toMethod &&
    (toMethod !== "SPLIT" || (order.splitCashAmount === toCashAmount && order.splitQrisAmount === toQrisAmount));
  if (unchanged) return { ok: false, error: "Metode bayar itu sama dengan yang sekarang — tidak ada yang diubah." };

  const fromMethod = order.paymentMethod; // always set once status is PAID

  try {
    await prisma.$transaction(async (tx) => {
      // Re-checked in the WHERE, inside the transaction, so a void or another
      // change racing in at the same moment can't both win.
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: "PAID", shift: { status: "OPEN" } },
        data: {
          paymentMethod: toMethod,
          splitCashAmount: toMethod === "SPLIT" ? toCashAmount : null,
          splitQrisAmount: toQrisAmount,
        },
      });
      if (updated.count !== 1) {
        throw new ChangeRefused("Order ini baru saja berubah (di-void, atau shift-nya baru ditutup). Muat ulang layar lalu coba lagi.");
      }
      await tx.paymentMethodChange.create({
        data: {
          orderId,
          fromMethod: fromMethod!,
          fromCashAmount: order.splitCashAmount,
          fromQrisAmount: order.splitQrisAmount,
          toMethod,
          toCashAmount: toMethod === "SPLIT" ? toCashAmount : null,
          toQrisAmount,
          reason: trimmed,
          changedById: user.id,
        },
      });
    });
  } catch (e) {
    if (e instanceof ChangeRefused) return { ok: false, error: e.message };
    throw e;
  }

  return { ok: true };
}

class ChangeRefused extends Error {}
