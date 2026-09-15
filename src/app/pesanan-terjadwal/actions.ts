"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/get-current-user";
import { buildOrderItemsCreateData, type OrderItemInput } from "@/lib/orders/build-order-items";
import { TABLE_LABELS, type ChannelType, type TableLabel } from "@/lib/cart/types";

export type SavePreOrderInput = {
  channel: ChannelType;
  tableLabel: TableLabel | null;
  customerName: string;
  scheduledFor: string; // ISO datetime
  items: OrderItemInput[];
};

export type SavePreOrderResult = { ok: true; orderId: string } | { ok: false; error: string };

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
    },
  });

  return { ok: true, orderId: order.id };
}
