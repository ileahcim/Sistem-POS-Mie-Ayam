import type { ActiveOrder } from "@/lib/orders/get-active-orders";
import { BULK_ORDER_QTY_THRESHOLD } from "@/lib/orders/pricing";
import { ListRow } from "@/components/ui/list-row";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

const CHANNEL_LABEL: Record<ActiveOrder["channel"], string> = {
  DINE_IN: "",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

function elapsedMinutes(createdAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000));
}

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
  const estimateMinutes = prepBaseMinutes + prepMinutesPerPortion * order.portionsToCook;
  const timerClass =
    minutes >= estimateMinutes * 2
      ? "text-danger font-bold"
      : minutes >= estimateMinutes
        ? "text-warning font-bold"
        : "text-ink-muted";

  const secondColumn = order.channel === "DINE_IN" ? order.tableLabel : CHANNEL_LABEL[order.channel];

  const itemSummary = order.items
    .map((i) => (i.qty > 1 ? `${i.productName} x${i.qty}` : i.productName))
    .join(", ");

  return (
    <ListRow onClick={onTap} className={cn(isBulk && "bg-info-soft")}>
      <span className="w-12 shrink-0 text-lg font-bold text-ink">#{order.queueNumber}</span>
      <span className="text-ink w-20 shrink-0 text-sm font-semibold">{secondColumn}</span>
      <span className="text-ink-muted flex-1 truncate text-sm">{itemSummary}</span>
      {isBulk && <Badge variant="info">Borongan</Badge>}
      {order.status === "PAID" && <Badge variant="success">Lunas</Badge>}
      <span className={cn("w-16 shrink-0 text-right text-sm", timerClass)}>{minutes} mnt</span>
    </ListRow>
  );
}
