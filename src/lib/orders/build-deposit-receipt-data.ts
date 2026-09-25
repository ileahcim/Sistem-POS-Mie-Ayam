import type { OrderDetail } from "./get-order-detail";
import type { StoreSettings } from "@/lib/settings/get-settings";
import type { DepositReceiptData } from "@/lib/printing/types";

// "BUKTI UANG MUKA" for ONE deposit of a pre-order. It lists every DP received
// up to and including that one (oldest first), so a customer who pays DP twice
// holds a proof per payment, each showing what has been paid so far and what
// is still owed. Works on the order as it is now: if the order was edited
// after the DP, the proof reprinted later shows the current total.
export function buildDepositReceiptData(
  order: OrderDetail,
  depositId: string,
  settings: StoreSettings,
): DepositReceiptData {
  const index = order.deposits.findIndex((d) => d.id === depositId);
  if (index === -1) throw new Error("DP tidak ditemukan di order ini.");
  if (!order.scheduledFor) throw new Error("Order ini bukan pesanan terjadwal.");
  const thisDeposit = order.deposits[index];

  return {
    storeName: settings.storeName,
    address: settings.address,
    phone: settings.phone,
    orderNumber: order.orderNumber,
    customerName: order.customerName ?? "",
    kasirName: thisDeposit.receivedByName,
    printedAt: new Date(thisDeposit.receivedAt),
    scheduledFor: new Date(order.scheduledFor),
    channel: order.channel,
    tableLabel: order.tableLabel,
    items: order.items.map((item) => ({
      productName: item.productName,
      addons: item.addons,
      notes: item.notes,
      qty: item.qty,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      categorySortOrder: item.categorySortOrder,
      productSortOrder: item.productSortOrder,
    })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    deposits: order.deposits.slice(0, index + 1).map((d) => ({
      receivedAt: new Date(d.receivedAt),
      method: d.method,
      amount: d.amount,
    })),
    cashTendered: thisDeposit.cashTendered,
    changeGiven: thisDeposit.changeGiven,
    footerNote: settings.receiptFooter,
    printLogo: settings.printLogo,
  };
}
