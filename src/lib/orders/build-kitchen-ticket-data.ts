import type { KitchenTicketData, KitchenTicketKind, ReceiptChannel } from "@/lib/printing/types";
import { portionPriceOf } from "./line-order";

// No prisma import here on purpose: this is a pure function, called from a
// server action right after a save (saveOrder, addItemsToOrder) AND from a
// client component for the manual reprint button (order-detail.tsx already
// holds the order's items as a prop) — see CLAUDE.md "Kertas dapur".

export type KitchenTicketOrderInfo = {
  queueNumber: number | null;
  queueSuffix: string;
  channel: ReceiptChannel;
  tableLabel: string | null;
  customerName: string | null;
};

// Structural, not imported from a specific caller: both OrderItemDisplayData
// (build-order-items.ts, a freshly-saved/added line) and OrderDetailItem
// (get-order-detail.ts, an already-saved order read back for the manual
// reprint button) satisfy this shape without needing to import either.
export type KitchenTicketSourceItem = {
  productId: string;
  productName: string;
  qty: number;
  notes: string | null;
  unitPrice: number;
  addons: { name: string; price: number }[];
  isDeliveryChargeable: boolean;
  isKitchenItem: boolean;
  categorySortOrder: number;
  productSortOrder: number;
};

// Builds the kitchen ticket for a set of lines — the whole order (kind
// "FULL", right after saveOrder) or only the lines just added to an
// already-saved order (kind "ADDITIONAL", right after addItemsToOrder —
// CLAUDE.md is explicit that a "TAMBAHAN" ticket never repeats the whole
// order). Returns null when NONE of the given lines need the kitchen at all
// (isKitchenItem — the same flag the Order Aktif prep timer uses: Makanan
// and Minuman Racik only, Kulkas/Lain-lain/Frozen are grab-and-go) — the
// caller then skips the print prompt/button entirely rather than offering an
// empty ticket.
export function buildKitchenTicketData(
  order: KitchenTicketOrderInfo,
  items: readonly KitchenTicketSourceItem[],
  kind: KitchenTicketKind,
): KitchenTicketData | null {
  const kitchenItems = items.filter((i) => i.isKitchenItem);
  if (kitchenItems.length === 0) return null;

  return {
    kind,
    queueNumber: order.queueNumber,
    queueSuffix: order.queueSuffix,
    channel: order.channel,
    tableLabel: order.tableLabel,
    customerName: order.customerName,
    printedAt: new Date(),
    items: kitchenItems.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      addons: i.addons.map((a) => a.name),
      notes: i.notes,
      qty: i.qty,
      isDeliveryChargeable: i.isDeliveryChargeable,
      categorySortOrder: i.categorySortOrder,
      productSortOrder: i.productSortOrder,
      portionPrice: portionPriceOf(i),
    })),
  };
}
