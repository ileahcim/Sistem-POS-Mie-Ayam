import type { OrderDetail } from "./get-order-detail";
import type { StoreSettings } from "@/lib/settings/get-settings";
import type { ReceiptData } from "@/lib/printing/types";

// Order must already be paid (paymentMethod set) — this is only ever called
// right after a successful payOrder().
export function buildReceiptData(order: OrderDetail, settings: StoreSettings): ReceiptData {
  if (!order.paymentMethod) throw new Error("Order belum dibayar, tidak bisa cetak struk.");

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
