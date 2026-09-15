import type { OrderDetail } from "./get-order-detail";
import type { StoreSettings } from "@/lib/settings/get-settings";
import type { PackingListData } from "@/lib/printing/types";

// Antar-only, printed before payment — checklist for assembling the order,
// not proof of payment. See CLAUDE.md "Struk & printer".
export function buildPackingListData(order: OrderDetail, settings: StoreSettings): PackingListData {
  return {
    storeName: settings.storeName,
    orderNumber: order.orderNumber,
    queueNumber: order.queueNumber, // null for a due-but-unpaid pre-order — see CLAUDE.md "Pre-order"
    printedAt: new Date(),
    tableLabel: order.tableLabel,
    items: order.items.map((item) => ({
      productName: item.productName,
      addons: item.addons.map((a) => a.name),
      notes: item.notes,
      qty: item.qty,
    })),
  };
}
