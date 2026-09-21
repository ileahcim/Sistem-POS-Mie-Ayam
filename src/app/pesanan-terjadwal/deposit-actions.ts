"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth/get-current-user";
import { getOrderDetail } from "@/lib/orders/get-order-detail";
import { buildDepositReceiptData } from "@/lib/orders/build-deposit-receipt-data";
import { orderTotalFromLines } from "@/lib/orders/order-total";
import { validateDeposit } from "@/lib/deposits/validate";
import { isDepositMethod, type DepositMethod } from "@/lib/deposits/settle";
import { getSettings } from "@/lib/settings/get-settings";
import type { DepositReceiptData } from "@/lib/printing/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type DepositReceiptResult =
  | { ok: true; depositId: string; receipt: DepositReceiptData }
  | { ok: false; error: string };

// Thrown inside a transaction to roll it back with a message the user can read.
class DepositRefused extends Error {}

// "+ Catat DP" — money a customer hands over before collecting a pre-order.
// Any logged-in user may record one (it is money IN, like taking a payment).
//
// A CASH DP physically enters the drawer today, so it must belong to a shift —
// that is what puts it into today's reconciliation as a receipt (not as a
// sale). No open shift, no cash DP; a QRIS DP never touches the drawer, so it
// stays possible at night when the orders come in over WhatsApp.
//
// The first statement is a no-op UPDATE on the order row: it takes the row lock
// and re-checks status, so a DP can never slip in while the order is being paid
// or cancelled on another device (payOrder / cancelOrderWithDeposit take the
// same lock before they read the ledger).
export async function recordDeposit(
  orderId: string,
  amount: number,
  method: DepositMethod,
): Promise<DepositReceiptResult> {
  const user = await requireUser();

  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Nominal DP tidak valid." };
  if (!isDepositMethod(method)) return { ok: false, error: "Metode DP harus Cash atau QRIS." };

  let depositId: string;
  try {
    depositId = await prisma.$transaction(async (tx) => {
      const locked = await tx.order.updateMany({
        where: { id: orderId, status: "OPEN", scheduledFor: { not: null } },
        data: { updatedAt: new Date() },
      });
      if (locked.count !== 1) {
        throw new DepositRefused("DP hanya bisa dicatat untuk pesanan terjadwal yang belum dibayar.");
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, deposits: true },
      });
      const held = order.deposits.filter((d) => d.kind === "RECEIVED").reduce((sum, d) => sum + d.amount, 0);
      const problem = validateDeposit({
        amount,
        method,
        total: orderTotalFromLines(order.items, order.channel),
        alreadyHeld: held,
      });
      if (problem) throw new DepositRefused(problem);

      const openShift = await tx.shift.findFirst({ where: { status: "OPEN" } });
      if (method === "CASH" && !openShift) {
        throw new DepositRefused(
          "DP tunai butuh shift terbuka — uangnya masuk laci. Buka shift dulu, atau catat DP lewat QRIS.",
        );
      }

      const entry = await tx.preorderDeposit.create({
        data: {
          orderId,
          kind: "RECEIVED",
          method,
          amount,
          shiftId: openShift?.id ?? null,
          createdById: user.id,
        },
      });
      return entry.id;
    });
  } catch (e) {
    if (e instanceof DepositRefused) return { ok: false, error: e.message };
    throw e;
  }

  return buildReceipt(orderId, depositId);
}

// Reprint the "BUKTI UANG MUKA" of one deposit.
export async function getDepositReceipt(orderId: string, depositId: string): Promise<DepositReceiptResult> {
  await requireUser();
  return buildReceipt(orderId, depositId);
}

async function buildReceipt(orderId: string, depositId: string): Promise<DepositReceiptResult> {
  const [order, settings] = await Promise.all([getOrderDetail(orderId), getSettings()]);
  if (!order) return { ok: false, error: "Order tidak ditemukan." };
  if (!order.deposits.some((d) => d.id === depositId)) return { ok: false, error: "DP tidak ditemukan." };
  return { ok: true, depositId, receipt: buildDepositReceiptData(order, depositId, settings) };
}

export type DepositDisposition = "REFUND" | "FORFEIT";

// Cancelling a pre-order that holds DP. The DP is real money already received,
// so cancelling has to say what happens to it — that is why this is not the
// plain "Batalkan Order" (which refuses an order with DP):
//   REFUND  — "Kembalikan DP": handed back the way it came in. A cash DP leaves
//             the drawer today (needs an open shift, and shows on the shift
//             close as "DP dikembalikan tunai"); a QRIS DP is a non-cash refund.
//   FORFEIT — "DP hangus": the customer cancelled and the DP is kept. It is
//             recognised as revenue today, on its own line (never as a food sale,
//             so top-menu and margin stay clean), and the cash is already in
//             the drawer from the day it was received. Needs an open shift so it
//             lands on a day.
// OWNER only, reason required.
export async function cancelOrderWithDeposit(
  orderId: string,
  disposition: DepositDisposition,
  reason: string,
): Promise<ActionResult> {
  const user = await requireRole("OWNER");

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Isi alasan pembatalan." };
  if (disposition !== "REFUND" && disposition !== "FORFEIT") {
    return { ok: false, error: "Pilih Kembalikan DP atau DP hangus." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.order.updateMany({
        where: { id: orderId, status: "OPEN" },
        data: { updatedAt: new Date() },
      });
      if (locked.count !== 1) {
        throw new DepositRefused("Order ini sudah dibayar/tidak aktif — tidak bisa dibatalkan.");
      }

      const ledger = await tx.preorderDeposit.findMany({ where: { orderId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      const received = ledger.filter((d) => d.kind === "RECEIVED");
      if (received.length === 0) {
        throw new DepositRefused("Order ini tidak punya DP — batalkan lewat tombol Batalkan Order biasa.");
      }

      const openShift = await tx.shift.findFirst({ where: { status: "OPEN" } });
      if (disposition === "REFUND") {
        if (received.some((d) => d.method === "CASH") && !openShift) {
          throw new DepositRefused(
            "Mengembalikan DP tunai butuh shift terbuka — uangnya keluar dari laci. Buka shift dulu.",
          );
        }
      } else if (!openShift) {
        throw new DepositRefused("DP hangus dicatat sebagai pendapatan hari ini — buka shift dulu.");
      }

      await tx.preorderDeposit.createMany({
        data: received.map((d) => ({
          orderId,
          kind: disposition === "REFUND" ? ("REFUNDED" as const) : ("FORFEITED" as const),
          method: d.method,
          amount: d.amount,
          shiftId: openShift?.id ?? null,
          note: trimmed,
          createdById: user.id,
        })),
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED", cancelReason: trimmed, cancelledById: user.id, cancelledAt: new Date() },
      });
    });
  } catch (e) {
    if (e instanceof DepositRefused) return { ok: false, error: e.message };
    throw e;
  }
  return { ok: true };
}
