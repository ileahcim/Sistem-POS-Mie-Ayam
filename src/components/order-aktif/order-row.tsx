import type { ActiveOrder } from "@/lib/orders/get-active-orders";
import { BULK_ORDER_QTY_THRESHOLD } from "@/lib/orders/pricing";
import { computeEstimateMinutes, elapsedMinutes, isLateOrder } from "@/lib/orders/prep-timer";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { ListRow } from "@/components/ui/list-row";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

const CHANNEL_LABEL: Record<ActiveOrder["channel"], string> = {
  DINE_IN: "",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

export function OrderRow({
  order,
  now,
  prepBaseMinutes,
  prepMinutesPerPortion,
  onTap,
}: {
  order: ActiveOrder;
  now: Date;
  prepBaseMinutes: number;
  prepMinutesPerPortion: number;
  onTap: () => void;
}) {
  const minutes = elapsedMinutes(order.createdAt, now);
  const isBulk = order.totalQty > BULK_ORDER_QTY_THRESHOLD;

  // Estimate scales with how much there actually is to cook, so a big
  // "borongan" order gets a proportionally longer grace period instead of
  // being exempt from the warning outright.
  const estimateMinutes = computeEstimateMinutes(prepBaseMinutes, prepMinutesPerPortion, order.portionsToCook);
  const timerClass = isLateOrder(minutes, estimateMinutes)
    ? "text-danger font-bold"
    : minutes >= estimateMinutes
      ? "text-warning font-bold"
      : "text-ink-muted";

  const secondColumn = order.channel === "DINE_IN" ? order.tableLabel : CHANNEL_LABEL[order.channel];

  const itemSummary = order.items
    .map((i) => (i.qty > 1 ? `${i.productName} x${i.qty}` : i.productName))
    .join(", ");

  return (
    <ListRow onClick={onTap} dense className={cn(isBulk && "bg-info-soft")}>
      <span className="w-14 shrink-0 text-lg font-bold text-ink">
        {formatQueueLabel(order.queueNumber, order.queueSuffix)}
      </span>
      <span className="text-ink w-20 shrink-0 text-sm font-semibold">{secondColumn}</span>
      <span className="text-ink-muted flex-1 truncate text-sm">{itemSummary}</span>
      {order.queueNumber == null && <Badge variant="info">Pre-order</Badge>}
      {isBulk && <Badge variant="info">Borongan</Badge>}
      {order.status === "PAID" && <Badge variant="success">Lunas</Badge>}
      <span className={cn("w-16 shrink-0 text-right text-sm", timerClass)}>{minutes} mnt</span>
    </ListRow>
  );
}
