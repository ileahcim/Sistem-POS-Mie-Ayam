"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/get-current-user";
import { buildOrderItemsCreateData, type OrderItemInput } from "@/lib/orders/build-order-items";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function markServed(orderId: string): Promise<ActionResult> {
  await requireUser();
  await prisma.order.updateMany({
    where: { id: orderId, servedAt: null },
    data: { servedAt: new Date() },
  });
  return { ok: true };
}

// New items only — existing lines on a saved order are never edited or
// removed here (that requires an OWNER void with a reason, or belongs on a
// new order once the current one is PAID). See OrderDetail's UI: this is
// unavailable once status is PAID.
export async function addItemsToOrder(orderId: string, items: OrderItemInput[]): Promise<ActionResult> {
  await requireUser();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order tidak ditemukan." };
  if (order.status !== "OPEN") {
    return { ok: false, error: "Order ini sudah dibayar/tidak aktif — tidak bisa ditambah item." };
  }

  let itemsData;
  try {
    itemsData = await buildOrderItemsCreateData(items);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memproses item." };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { items: { create: itemsData } },
  });

  return { ok: true };
}
