import type { ActiveOrder } from "@/lib/orders/get-active-orders";
import { BULK_ORDER_QTY_THRESHOLD } from "@/lib/orders/pricing";
import { computeEstimateMinutes, elapsedMinutes, isLateOrder } from "@/lib/orders/prep-timer";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { ListRow } from "@/components/ui/list-row";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { CancelOrderButton } from "./cancel-order-sheet";

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
  onCancelled,
}: {
  order: ActiveOrder;
  now: Date;
  prepBaseMinutes: number;
  prepMinutesPerPortion: number;
  onTap: () => void;
  onCancelled: () => void;
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

  const queueLabel = formatQueueLabel(order.queueNumber, order.queueSuffix);

  // Only an unpaid order can be cancelled from here (see cancelOrder) — a
  // PAID row still waiting to be served has no Batal button at all.
  return (
    <div className={cn("border-border flex items-center border-b last:border-b-0", isBulk && "bg-info-soft")}>
      <ListRow onClick={onTap} dense noDivider className="min-w-0 flex-1">
        <span className="w-14 shrink-0 text-lg font-bold text-ink">{queueLabel}</span>
        <span className="text-ink w-20 shrink-0 text-sm font-semibold">{secondColumn}</span>
        <span className="text-ink-muted flex-1 truncate text-sm">{itemSummary}</span>
        {order.queueNumber == null && <Badge variant="info">Pre-order</Badge>}
        {isBulk && <Badge variant="info">Borongan</Badge>}
        {order.status === "PAID" && <Badge variant="success">Lunas</Badge>}
        <span className={cn("w-16 shrink-0 text-right text-sm", timerClass)}>{minutes} mnt</span>
      </ListRow>
      {order.status === "OPEN" && !order.hasDeposit ? (
        <CancelOrderButton
          size="compact"
          orderId={order.id}
          orderLabel={order.queueNumber != null ? queueLabel : null}
          onCancelled={onCancelled}
        />
      ) : (
        // same footprint as the Batal button, so the timer column lines up
        <span className="mr-3 w-16 shrink-0" aria-hidden />
      )}
    </div>
  );
}
