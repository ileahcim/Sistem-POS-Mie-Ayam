"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/get-current-user";
import { buildOrderItemsCreateData, type OrderItemInput } from "@/lib/orders/build-order-items";
import { TABLE_LABELS, type ChannelType, type TableLabel } from "@/lib/cart/types";
import { getOrderDetail } from "@/lib/orders/get-order-detail";
import { buildDepositReceiptData } from "@/lib/orders/build-deposit-receipt-data";
import { orderTotalFromLines } from "@/lib/orders/order-total";
import { validateDeposit } from "@/lib/deposits/validate";
import type { DepositMethod } from "@/lib/deposits/settle";
import { getSettings } from "@/lib/settings/get-settings";
import type { DepositReceiptData } from "@/lib/printing/types";

export type SavePreOrderInput = {
  channel: ChannelType;
  tableLabel: TableLabel | null;
  customerName: string;
  scheduledFor: string; // ISO datetime
  items: OrderItemInput[];
  // Optional DP (uang muka) taken together with the order.
  deposit?: { amount: number; method: DepositMethod } | null;
};

export type SavePreOrderResult =
  // depositReceipt: the "BUKTI UANG MUKA" to print, present only when a DP was taken.
  | { ok: true; orderId: string; depositReceipt?: DepositReceiptData }
  | { ok: false; error: string };

// Deliberately does NOT check for an open shift — see CLAUDE.md "Pre-order":
// these are taken over WhatsApp at night while the warung is closed. No
// shiftId/queueNumber is assigned here either; both stay null until the
// order is actually paid (payOrder in pembayaran/actions.ts attaches
// whichever shift is open at that moment), so the sale lands in the
// delivery day's shift instead of the ordering day's.
export async function savePreOrder(input: SavePreOrderInput): Promise<SavePreOrderResult> {
  const user = await requireUser();

  if (input.items.length === 0) {
    return { ok: false, error: "Keranjang masih kosong." };
  }
  if (input.channel === "DINE_IN" && !input.tableLabel) {
    return { ok: false, error: "Pilih meja dulu." };
  }
  if (input.tableLabel && !TABLE_LABELS.includes(input.tableLabel)) {
    return { ok: false, error: "Meja tidak valid." };
  }
  if (!input.customerName.trim()) {
    return { ok: false, error: "Isi nama pemesan dulu — belum ada nomor antrian untuk pre-order." };
  }

  const scheduledFor = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    return { ok: false, error: "Tanggal & jam kirim tidak valid." };
  }
  if (scheduledFor.getTime() <= Date.now()) {
    return { ok: false, error: "Tanggal & jam kirim harus di masa depan." };
  }

  let itemsData;
  try {
    itemsData = await buildOrderItemsCreateData(input.items);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memproses item." };
  }

  // DP taken together with the order: validated against the real total before
  // anything is written, and created in the same statement as the order so an
  // order can never exist without the DP the customer just handed over.
  const deposit = input.deposit ?? null;
  let depositShiftId: string | null = null;
  if (deposit) {
    const problem = validateDeposit({
      amount: deposit.amount,
      method: deposit.method,
      total: orderTotalFromLines(itemsData, input.channel),
      alreadyHeld: 0,
    });
    if (problem) return { ok: false, error: problem };

    // Cash goes into the drawer, so it needs a shift to belong to; QRIS never
    // touches the drawer and stays possible with the warung closed.
    const openShift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
    if (deposit.method === "CASH" && !openShift) {
      return {
        ok: false,
        error: "DP tunai butuh shift terbuka — uangnya masuk laci. Buka shift dulu, atau catat DP lewat QRIS.",
      };
    }
    depositShiftId = openShift?.id ?? null;
  }

  const order = await prisma.order.create({
    data: {
      shiftId: null,
      queueNumber: null,
      channel: input.channel,
      tableLabel: input.tableLabel,
      customerName: input.customerName.trim(),
      scheduledFor,
      createdById: user.id,
      items: { create: itemsData },
      ...(deposit
        ? {
            deposits: {
              create: {
                kind: "RECEIVED" as const,
                method: deposit.method,
                amount: deposit.amount,
                shiftId: depositShiftId,
                createdById: user.id,
              },
            },
          }
        : {}),
    },
    include: { deposits: true },
  });

  const firstDeposit = order.deposits[0];
  if (!firstDeposit) return { ok: true, orderId: order.id };

  const [detail, settings] = await Promise.all([getOrderDetail(order.id), getSettings()]);
  return {
    ok: true,
    orderId: order.id,
    depositReceipt: detail ? buildDepositReceiptData(detail, firstDeposit.id, settings) : undefined,
  };
}
