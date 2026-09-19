import type { OrderDetail } from "./get-order-detail";
import type { StoreSettings } from "@/lib/settings/get-settings";
import type { PackingListData } from "@/lib/printing/types";
import { groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";

// Antar-only, printed before payment — checklist for assembling the order,
// not proof of payment. See CLAUDE.md "Struk & printer".
export function buildPackingListData(order: OrderDetail, settings: StoreSettings): PackingListData {
  return {
    storeName: settings.storeName,
    address: settings.address,
    phone: settings.phone,
    orderNumber: order.orderNumber,
    queueNumber: order.queueNumber, // null for a due-but-unpaid pre-order — see CLAUDE.md "Pre-order"
    queueSuffix: order.queueSuffix,
    printedAt: new Date(),
    tableLabel: order.tableLabel,
    printLogo: settings.printLogo,
    items: order.items.map((item) => ({
      productName: item.productName,
      addons: groupAddonsForPrint(item.addons).map(formatAddonWithQty),
      notes: item.notes,
      qty: item.qty,
    })),
  };
}
