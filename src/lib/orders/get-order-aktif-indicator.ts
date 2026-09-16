import { getActiveOrders } from "./get-active-orders";
import { getSettings } from "@/lib/settings/get-settings";
import { computeEstimateMinutes, elapsedMinutes, isLateOrder } from "./prep-timer";

export type OrderAktifIndicator = {
  activeCount: number;
  lateCount: number;
};

// Powers the app-wide header button + warning bar (OrderAktifButton /
// LateOrderBanner) — every screen with a header calls this once per
// request so the indicator is never more than one navigation stale. Reuses
// getActiveOrders() rather than re-querying, so "late" here can never
// disagree with the red timer text already shown on the Order Aktif list
// itself (same portionsToCook, same createdAt, same prep-timer.ts rules).
export async function getOrderAktifIndicator(): Promise<OrderAktifIndicator> {
  const [orders, settings] = await Promise.all([getActiveOrders(), getSettings()]);
  const now = new Date();
  const lateCount = orders.filter((o) => {
    const estimate = computeEstimateMinutes(settings.prepBaseMinutes, settings.prepMinutesPerPortion, o.portionsToCook);
    return isLateOrder(elapsedMinutes(o.createdAt, now), estimate);
  }).length;
  return { activeCount: orders.length, lateCount };
}
