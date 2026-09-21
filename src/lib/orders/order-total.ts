import { DELIVERY_FEE_PER_FOOD_ITEM } from "./pricing";

// An order's total from its stored lines: subtotal plus the Antar delivery fee.
// Never stored on Order — always recomputed, and this is the one place the
// server does it from raw rows (closing a shift, settling a payment), so the
// two can never disagree about what an order was worth.
export function orderTotalFromLines(
  lines: readonly { lineTotal: number; qty: number; isDeliveryChargeable: boolean }[],
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR",
): number {
  const subtotal = lines.reduce((sum, i) => sum + i.lineTotal, 0);
  const deliveryFee =
    channel === "ANTAR"
      ? lines.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) * DELIVERY_FEE_PER_FOOD_ITEM
      : 0;
  return subtotal + deliveryFee;
}
