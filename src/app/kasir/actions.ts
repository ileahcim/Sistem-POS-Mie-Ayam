"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/get-current-user";
import { buildOrderItemsCreateData, type OrderItemInput } from "@/lib/orders/build-order-items";
import { TABLE_LABELS, type ChannelType, type TableLabel } from "@/lib/cart/types";

export type SaveOrderInput = {
  channel: ChannelType;
  tableLabel: TableLabel | null;
  customerName: string | null;
  items: OrderItemInput[];
};

export type SaveOrderResult =
  | { ok: true; orderId: string; queueNumber: number }
  | { ok: false; error: string };

// Prices/names are re-read from the DB (inside buildOrderItemsCreateData),
// never trusted from the client — this IS the snapshot moment ("Harga, nama
// produk, dan HPP di-snapshot ke baris order item saat transaksi").
export async function saveOrder(input: SaveOrderInput): Promise<SaveOrderResult> {
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

  const openShift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
  if (!openShift) {
    return { ok: false, error: "Belum ada shift terbuka. Buka shift dulu sebelum transaksi." };
  }

  let itemsData;
  try {
    itemsData = await buildOrderItemsCreateData(input.items);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memproses item." };
  }

  const order = await prisma.$transaction(async (tx) => {
    const shift = await tx.shift.update({
      where: { id: openShift.id },
      data: { lastQueueNumber: { increment: 1 } },
    });

    return tx.order.create({
      data: {
        shiftId: shift.id,
        queueNumber: shift.lastQueueNumber,
        channel: input.channel,
        tableLabel: input.tableLabel,
        customerName: input.customerName,
        createdById: user.id,
        items: { create: itemsData },
      },
    });
  });

  return { ok: true, orderId: order.id, queueNumber: order.queueNumber };
}
