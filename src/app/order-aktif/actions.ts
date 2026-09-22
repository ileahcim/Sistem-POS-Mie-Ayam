"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/get-current-user";
import { buildOrderItemsCreateData, type OrderItemInput } from "@/lib/orders/build-order-items";
import { buildKitchenTicketData } from "@/lib/orders/build-kitchen-ticket-data";
import type { KitchenTicketData } from "@/lib/printing/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type AddItemsResult =
  // kitchenTicket ("TAMBAHAN") covers ONLY the lines just added by this call,
  // never the whole order — see CLAUDE.md "Kertas dapur". null when none of
  // them need the kitchen at all.
  | { ok: true; kitchenTicket: KitchenTicketData | null }
  | { ok: false; error: string };

export async function markServed(orderId: string): Promise<ActionResult> {
  await requireUser();
  await prisma.order.updateMany({
    where: { id: orderId, servedAt: null },
    data: { servedAt: new Date() },
  });
  return { ok: true };
}

// "Batalkan Order" — an OPEN (unpaid) order entered by mistake, or the
// customer changed their mind. Any logged-in user may do this (CASHIER
// included): no money has moved yet, unlike a VOID, which stays OWNER-only.
// A short reason is still required so the cancellation is traceable later
// in Riwayat Pesanan. The status check lives inside the update's WHERE so a
// concurrent payment can never be overwritten into a cancellation.
export async function cancelOrder(orderId: string, reason: string): Promise<ActionResult> {
  const user = await requireUser();

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Isi alasan pembatalan." };

  // "No DP" is part of the WHERE for the same reason status is: a pre-order that
  // took DP holds real money, so cancelling it has to say what happens to that
  // money — that is cancelOrderWithDeposit (OWNER), never this plain path.
  const result = await prisma.order.updateMany({
    where: { id: orderId, status: "OPEN", deposits: { none: {} } },
    data: { status: "CANCELLED", cancelReason: trimmed, cancelledById: user.id, cancelledAt: new Date() },
  });
  if (result.count === 0) {
    const holdsDeposit = await prisma.preorderDeposit.count({ where: { orderId } });
    if (holdsDeposit > 0) {
      return {
        ok: false,
        error:
          "Order ini punya DP — pembatalannya hanya oleh pemilik, lewat detail order (pilih Kembalikan DP atau DP hangus).",
      };
    }
    return { ok: false, error: "Order ini sudah dibayar/tidak aktif — tidak bisa dibatalkan." };
  }
  return { ok: true };
}

// Adds new lines to a saved order. Undoing a mis-tap is removeOrderItem
// below; once the order is PAID neither is available (a paid order is
// frozen — extra items become a new order).
export async function addItemsToOrder(orderId: string, items: OrderItemInput[]): Promise<AddItemsResult> {
  await requireUser();

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false, error: "Order tidak ditemukan." };
  if (order.status !== "OPEN") {
    return { ok: false, error: "Order ini sudah dibayar/tidak aktif — tidak bisa ditambah item." };
  }

  let itemsData, display;
  try {
    ({ items: itemsData, display } = await buildOrderItemsCreateData(items));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memproses item." };
  }

  // A forgotten portion of something already on the order bumps that line's
  // qty instead of opening a second identical row — the same rule the cart
  // follows on screen. The unit-total check is what makes that safe: it
  // merges only when the added portion costs exactly what the existing line
  // charges per portion, so a price changed since the order was opened
  // still gets its own correctly-priced row rather than being back-dated.
  const toCreate: typeof itemsData = [];
  const bumps: { id: string; qty: number; lineTotal: number }[] = [];
  for (const data of itemsData) {
    const twin = order.items.find(
      (existing) =>
        existing.comboKey === data.comboKey &&
        (existing.notes ?? "") === (data.notes ?? "") &&
        existing.qty > 0 &&
        existing.lineTotal / existing.qty === data.lineTotal / data.qty,
    );
    if (twin) bumps.push({ id: twin.id, qty: twin.qty + data.qty, lineTotal: twin.lineTotal + data.lineTotal });
    else toCreate.push(data);
  }

  await prisma.$transaction([
    ...bumps.map((bump) =>
      prisma.orderItem.update({ where: { id: bump.id }, data: { qty: bump.qty, lineTotal: bump.lineTotal } }),
    ),
    ...(toCreate.length > 0
      ? [prisma.order.update({ where: { id: orderId }, data: { items: { create: toCreate } } })]
      : []),
  ]);

  // "TAMBAHAN" ticket for exactly the lines just added (display), never the
  // order's pre-existing lines — whether a given line bumped an existing row
  // or created a new one makes no difference here, `display` is the newly
  // added quantity either way.
  const kitchenTicket = buildKitchenTicketData(
    { queueNumber: order.queueNumber, queueSuffix: order.queueSuffix, channel: order.channel, tableLabel: order.tableLabel, customerName: order.customerName },
    display,
    "ADDITIONAL",
  );

  return { ok: true, kitchenTicket };
}

// Mis-tapped an item onto a saved order (adding was already possible, undoing
// it was not). Only while the order is still OPEN — a PAID order is frozen
// (CLAUDE.md "Order & status"), and emptying an order entirely is
// "Batalkan Order", not a silent delete, so the last remaining line is
// refused. `mode: "one"` drops a single portion off a multi-qty line;
// "all" removes the whole line. The order total is never stored — it's
// recomputed from the remaining items server-side (getOrderDetail), so
// there is nothing else to keep in sync here.
export async function removeOrderItem(
  orderId: string,
  orderItemId: string,
  mode: "one" | "all",
): Promise<ActionResult> {
  await requireUser();

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return { ok: false, error: "Order tidak ditemukan." };
    if (order.status !== "OPEN") {
      return { ok: false, error: "Order ini sudah dibayar/tidak aktif — tidak bisa diubah." };
    }

    const item = order.items.find((i) => i.id === orderItemId);
    if (!item) return { ok: false, error: "Item tidak ditemukan di order ini." };

    const removedQty = mode === "all" ? item.qty : 1;
    const totalQty = order.items.reduce((sum, i) => sum + i.qty, 0);
    if (removedQty >= totalQty) {
      return {
        ok: false,
        error: "Order harus menyisakan minimal 1 item. Untuk mengosongkan order, pakai Batalkan Order.",
      };
    }

    if (removedQty >= item.qty) {
      // OrderItemAddon has no cascade in the schema — its snapshot rows go
      // first, in the same transaction, or the delete hits the FK.
      await tx.orderItemAddon.deleteMany({ where: { orderItemId: item.id } });
      await tx.orderItem.delete({ where: { id: item.id } });
      return { ok: true };
    }

    const unitTotal = item.lineTotal / item.qty; // exact — lineTotal was always unitTotal * qty
    const nextQty = item.qty - removedQty;
    await tx.orderItem.update({
      where: { id: item.id },
      data: { qty: nextQty, lineTotal: unitTotal * nextQty },
    });
    return { ok: true };
  });
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
    // The DP belongs to the whole order; splitting would leave it against
    // whichever half happens to be paid first.
    if ((await tx.preorderDeposit.count({ where: { orderId } })) > 0) {
      return { ok: false, error: "Order ini punya DP — tidak bisa dipisah. Selesaikan lewat pembayaran biasa." };
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
