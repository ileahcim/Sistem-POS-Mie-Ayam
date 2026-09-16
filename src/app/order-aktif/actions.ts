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

export type SplitSelection = { orderItemId: string; qty: number };
export type SplitAndPayResult = { ok: true; newOrderId: string } | { ok: false; error: string };

// "Pisahkan & Bayar" — CLAUDE.md "Split payment": a group sat under one
// order but wants to pay separately. Moves the checked items (and, for a
// partial line like "Mie Ayam x3" with only 1 checked, splits that line in
// two — the rest stays on the parent) onto a brand-new Order that shares
// the parent's queueNumber but gets its own letter suffix ("18" -> "18-A")
// and its own fresh orderNumber. The new order is a completely ordinary,
// independently payable Order row — payOrder() needs no special case for
// it, which is exactly how "satu order = satu pembayaran = satu struk"
// stays true even for a split: nothing here is ever payable twice, because
// nothing here is shared between the two orders after this runs.
export async function splitAndPay(orderId: string, selections: SplitSelection[]): Promise<SplitAndPayResult> {
  const user = await requireUser();

  const cleanSelections = selections.filter((s) => s.qty > 0);
  if (cleanSelections.length === 0) {
    return { ok: false, error: "Pilih minimal 1 item untuk dipisah." };
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { addons: true } } },
    });
    if (!order) return { ok: false, error: "Order tidak ditemukan." };
    if (order.status !== "OPEN") {
      return { ok: false, error: "Order ini sudah tidak aktif — tidak bisa dipisah." };
    }

    const itemById = new Map(order.items.map((i) => [i.id, i]));
    for (const sel of cleanSelections) {
      const item = itemById.get(sel.orderItemId);
      if (!item) return { ok: false, error: "Item tidak ditemukan di order ini." };
      if (sel.qty > item.qty) {
        return { ok: false, error: `Jumlah yang dipisah untuk ${item.productName} melebihi yang tersedia.` };
      }
    }

    const totalQty = order.items.reduce((sum, i) => sum + i.qty, 0);
    const selectedQty = cleanSelections.reduce((sum, s) => sum + s.qty, 0);
    if (selectedQty >= totalQty) {
      return {
        ok: false,
        error: "Harus ada item yang tersisa di order asli. Untuk memindahkan semuanya, pakai alur bayar biasa.",
      };
    }

    // Every order sharing this (shiftId, queueNumber) family — the original
    // plus any earlier splits — counts toward the next letter, so repeated
    // splits of the same order keep handing out fresh suffixes (A, B, C…).
    const siblingCount = await tx.order.count({ where: { shiftId: order.shiftId, queueNumber: order.queueNumber } });
    const queueSuffix = String.fromCharCode("A".charCodeAt(0) + siblingCount - 1);

    const newOrder = await tx.order.create({
      data: {
        shiftId: order.shiftId,
        queueNumber: order.queueNumber,
        queueSuffix,
        channel: order.channel,
        tableLabel: order.tableLabel,
        customerName: order.customerName,
        status: "OPEN",
        servedAt: order.servedAt,
        createdById: user.id,
      },
    });

    for (const sel of cleanSelections) {
      const item = itemById.get(sel.orderItemId)!;
      const unitTotal = item.lineTotal / item.qty; // exact — lineTotal was always unitTotal * qty

      if (sel.qty === item.qty) {
        // Whole line moves as-is — its OrderItemAddon rows reference
        // orderItemId, not orderId, so nothing else needs to change.
        await tx.orderItem.update({ where: { id: item.id }, data: { orderId: newOrder.id } });
        continue;
      }

      await tx.orderItem.create({
        data: {
          orderId: newOrder.id,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          qty: sel.qty,
          notes: item.notes,
          isDeliveryChargeable: item.isDeliveryChargeable,
          isKitchenItem: item.isKitchenItem,
          comboKey: item.comboKey,
          lineTotal: unitTotal * sel.qty,
          addons: {
            create: item.addons.map((a) => ({
              addonOptionId: a.addonOptionId,
              name: a.name,
              price: a.price,
              costPrice: a.costPrice,
            })),
          },
        },
      });
      await tx.orderItem.update({
        where: { id: item.id },
        data: { qty: item.qty - sel.qty, lineTotal: unitTotal * (item.qty - sel.qty) },
      });
    }

    return { ok: true, newOrderId: newOrder.id };
  });
}
