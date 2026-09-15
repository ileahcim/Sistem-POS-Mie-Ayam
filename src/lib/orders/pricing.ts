import type { CartItem, ChannelType } from "@/lib/cart/types";
import { cartItemLineTotal } from "@/lib/cart/types";

export const DELIVERY_FEE_PER_FOOD_ITEM = 1000;

// Bulk ("borongan") orders are excluded from the Order Aktif timer-warning
// treatment. Threshold is total quantity across all lines, not number of
// distinct lines (a catering order is many portions, not necessarily many
// distinct products). Lives here (not get-active-orders.ts) because that
// module pulls in Prisma — importing a constant from it would drag the
// server-only DB client into the client bundle that renders the badge.
export const BULK_ORDER_QTY_THRESHOLD = 10;

export type OrderTotals = {
  subtotal: number;
  deliveryFee: number;
  total: number;
};

// Ongkir: Rp1.000 per porsi Makanan (by qty, not by line), only for channel
// Antar. Drinks, kerupuk, es batu, frozen never count — that's what
// isDeliveryChargeable snapshots per line.
export function computeOrderTotals(
  items: Pick<CartItem, "unitPrice" | "addons" | "qty" | "isDeliveryChargeable">[],
  channel: ChannelType | null,
): OrderTotals {
  const subtotal = items.reduce((sum, item) => sum + cartItemLineTotal(item), 0);

  const deliveryFee =
    channel === "ANTAR"
      ? items.reduce((sum, item) => sum + (item.isDeliveryChargeable ? item.qty : 0), 0) *
        DELIVERY_FEE_PER_FOOD_ITEM
      : 0;

  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

// Sorted fingerprint of a product + its addon selection, e.g. "p1-a3_a5_a7"
// (no addons: just "p1"). Written once per order item; powers the 30-day
// popular-combo aggregation without joining/comparing addon sets later.
export function buildComboKey(productId: string, addonOptionIds: string[]): string {
  const sortedAddons = [...addonOptionIds].sort();
  return sortedAddons.length > 0 ? `${productId}-${sortedAddons.join("_")}` : productId;
}
