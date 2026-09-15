import type { OrderDetail } from "./get-order-detail";
import type { StoreSettings } from "@/lib/settings/get-settings";
import type { ReceiptData } from "@/lib/printing/types";

// Order must already be paid (paymentMethod set) — this is only ever called
// right after a successful payOrder().
export function buildReceiptData(order: OrderDetail, settings: StoreSettings): ReceiptData {
  if (!order.paymentMethod) throw new Error("Order belum dibayar, tidak bisa cetak struk.");
  // payOrder() always attaches shiftId + queueNumber together at payment
  // time (including for a pre-order, whose queueNumber is null until then —
  // see CLAUDE.md "Pre-order"), so by the time paymentMethod is set this is
  // never null. The check just turns a broken invariant into a clear error
  // instead of printing "Antrian #null".
  if (order.queueNumber == null) throw new Error("Order belum punya nomor antrian, tidak bisa cetak struk.");

  return {
    storeName: settings.storeName,
    orderNumber: order.orderNumber,
    queueNumber: order.queueNumber,
    printedAt: order.paidAt ? new Date(order.paidAt) : new Date(),
    channel: order.channel,
    tableLabel: order.tableLabel,
    items: order.items.map((item) => ({
      productName: item.productName,
      addons: item.addons,
      notes: item.notes,
      qty: item.qty,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    paymentMethod: order.paymentMethod,
    cashTendered: order.cashTendered,
    changeGiven: order.changeGiven,
    footerNote: settings.receiptFooter,
  };
}
