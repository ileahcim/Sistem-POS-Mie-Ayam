"use client";

import { useState } from "react";
import type { ActiveOrder, ActiveOrderItem, UnpaidServedOrder } from "@/lib/orders/get-active-orders";
import { BULK_ORDER_QTY_THRESHOLD } from "@/lib/orders/pricing";
import { computeEstimateMinutes, elapsedMinutes, isLateOrder } from "@/lib/orders/prep-timer";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { sortOrderLines, portionPriceOf } from "@/lib/orders/line-order";
import { groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";
import { ListRow } from "@/components/ui/list-row";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { CancelOrderButton } from "./cancel-order-sheet";

const CHANNEL_LABEL: Record<ActiveOrder["channel"], string> = {
  DINE_IN: "",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

// Up to this many item lines are spelled out in the always-visible summary;
// the rest collapse into "+N lainnya" instead of trailing off with CSS
// ellipsis, so a big order still reads as a real count at a glance. Kept to
// one line (`truncate` as a last-resort backstop for long product names at
// 390px) so the collapsed row's height never grows — CLAUDE.md "Kepadatan
// layar kasir".
const SUMMARY_ITEM_COUNT = 2;

function buildItemSummary(lines: { productName: string; qty: number }[]): string {
  const shown = lines
    .slice(0, SUMMARY_ITEM_COUNT)
    .map((l) => (l.qty > 1 ? `${l.productName} x${l.qty}` : l.productName));
  const rest = lines.length - SUMMARY_ITEM_COUNT;
  return rest > 0 ? `${shown.join(", ")}, +${rest} lainnya` : shown.join(", ");
}

// Guest name (Order.customerName, CLAUDE.md "Order & status") shown right
// beside the channel/table label in BOTH Order Aktif sections — one helper so
// the two rows can't disagree on it again.
function channelAndGuestLabel(order: Pick<ActiveOrder, "channel" | "tableLabel" | "customerName">): string {
  const channel = order.channel === "DINE_IN" ? (order.tableLabel ?? "") : CHANNEL_LABEL[order.channel];
  return order.customerName ? `${channel} · ${order.customerName}` : channel;
}

// The tap-to-expand panel: every line with its add-ons and note, in the same
// reading order as the cart, the full order detail, and the printed paper
// (CLAUDE.md "Urutan baris" — callers pass lines already through
// sortOrderLines), plus the one explicit way into the order's own screen.
function ExpandedItems({ orderId, items }: { orderId: string; items: ActiveOrderItem[] }) {
  return (
    <div className="bg-canvas px-4 pb-3">
      <div className="border-border flex flex-col gap-2 border-t pt-2">
        {items.map((item) => (
          <div key={item.id} className="text-sm">
            <span className="text-ink font-medium">
              {item.qty > 1 ? `${item.qty}x ` : ""}
              {item.productName}
            </span>
            {(item.addons.length > 0 || item.notes) && (
              <p className="text-ink-muted text-xs">
                {[groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", "), item.notes]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        ))}
        <LinkButton href={`/order-aktif/${orderId}`} variant="secondary" size="large" fullWidth className="mt-1">
          Buka Detail (Bayar / Edit)
        </LinkButton>
      </div>
    </div>
  );
}

export function OrderRow({
  order,
  now,
  prepBaseMinutes,
  prepMinutesPerPortion,
  onCancelled,
}: {
  order: ActiveOrder;
  now: Date;
  prepBaseMinutes: number;
  prepMinutesPerPortion: number;
  onCancelled: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
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

  const secondColumnText = channelAndGuestLabel(order);
  const sortedItems = sortOrderLines(order.items, portionPriceOf);
  const itemSummary = buildItemSummary(sortedItems);

  const queueLabel = formatQueueLabel(order.queueNumber, order.queueSuffix);

  // Only an unpaid order can be cancelled from here (see cancelOrder) — a
  // PAID row still waiting to be served has no Batal button at all.
  return (
    <div className={cn("border-border border-b last:border-b-0", isBulk && "bg-info-soft")}>
      <div className="flex items-center">
        {/* Tapping the row toggles the expanded item list in place — it no
            longer navigates (CLAUDE.md "Order Aktif: isi pesanan langsung
            terlihat", 23 Sep 2026). Entering the order's own detail screen
            (bayar/edit/hapus item) needs a separate, explicit tap inside the
            expanded panel below, so the two can't be mistaken for each other. */}
        <ListRow onClick={() => setExpanded((v) => !v)} dense noDivider className="min-w-0 flex-1">
          <span className="w-14 shrink-0 text-lg font-bold text-ink">{queueLabel}</span>
          <span className="text-ink max-w-[9rem] shrink-0 truncate text-sm font-semibold">
            {secondColumnText}
          </span>
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

      {expanded && <ExpandedItems orderId={order.id} items={sortedItems} />}
    </div>
  );
}

// A row of "Sudah Disajikan · Menunggu Bayar": same always-visible summary and
// tap-to-expand panel as OrderRow (the section was left out when that shipped
// on 23 Sep 2026), minus the timer — the food is out, so nothing is late here.
export function ServedOrderRow({ order, onCancelled }: { order: UnpaidServedOrder; onCancelled: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const sortedItems = sortOrderLines(order.items, portionPriceOf);
  const queueLabel = formatQueueLabel(order.queueNumber, order.queueSuffix);

  return (
    <div className="border-border border-b last:border-b-0">
      <div className="flex items-center">
        <ListRow onClick={() => setExpanded((v) => !v)} dense noDivider className="min-w-0 flex-1">
          <span className="w-14 shrink-0 text-lg font-bold text-ink">{queueLabel}</span>
          <span className="text-ink max-w-[9rem] shrink-0 truncate text-sm font-semibold">
            {channelAndGuestLabel(order)}
          </span>
          <span className="text-ink-muted flex-1 truncate text-sm">{buildItemSummary(sortedItems)}</span>
        </ListRow>
        {order.hasDeposit ? (
          // Same footprint as the Batal button. An order that holds DP is
          // cancelled from its detail screen (owner picks the DP's fate).
          <span className="mr-3 w-16 shrink-0" aria-hidden />
        ) : (
          <CancelOrderButton size="compact" orderId={order.id} orderLabel={queueLabel} onCancelled={onCancelled} />
        )}
      </div>

      {expanded && <ExpandedItems orderId={order.id} items={sortedItems} />}
    </div>
  );
}
