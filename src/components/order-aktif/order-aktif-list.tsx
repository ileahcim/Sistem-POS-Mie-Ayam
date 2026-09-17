"use client";

import { useRouter } from "next/navigation";
import type { ActiveOrder, UnpaidServedOrder } from "@/lib/orders/get-active-orders";
import { useNow } from "@/lib/use-now";
import { computeEstimateMinutes, elapsedMinutes, isLateOrder } from "@/lib/orders/prep-timer";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { MainMenu } from "@/components/ui/main-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { NoOrdersIcon } from "@/components/ui/empty-state-icons";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { OrderRow } from "./order-row";
import { CancelOrderButton } from "./cancel-order-sheet";

const CHANNEL_LABEL: Record<UnpaidServedOrder["channel"], string> = {
  DINE_IN: "",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

export function OrderAktifList({
  orders,
  unpaidServed,
  prepBaseMinutes,
  prepMinutesPerPortion,
  isOwner,
}: {
  orders: ActiveOrder[];
  unpaidServed: UnpaidServedOrder[];
  prepBaseMinutes: number;
  prepMinutesPerPortion: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const now = useNow();

  // Computed from the same list/now the row timers already use, so this
  // banner ticks live in step with them instead of only refreshing on the
  // next navigation like the header indicator does on every other screen
  // (see get-order-aktif-indicator.ts) — and skips that redundant fetch,
  // since we're already sitting on the exact data it would recompute.
  const lateCount = orders.filter((o) =>
    isLateOrder(
      elapsedMinutes(o.createdAt, now),
      computeEstimateMinutes(prepBaseMinutes, prepMinutesPerPortion, o.portionsToCook),
    ),
  ).length;

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-3 py-2">
        <h1 className="text-lg font-bold text-ink">Order Aktif</h1>
        <div className="flex items-center gap-2">
          <LinkButton href="/kasir" variant="primary">Ke Kasir</LinkButton>
          <MainMenu isOwner={isOwner} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <Card>
          {orders.length === 0 ? (
            <EmptyState
              icon={<NoOrdersIcon />}
              title="Belum ada order aktif"
              description="Order yang dibuat di Kasir akan muncul di sini sampai selesai dibayar."
              actionHref="/kasir"
              actionLabel="Ke Kasir"
            />
          ) : (
            orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                now={now}
                prepBaseMinutes={prepBaseMinutes}
                prepMinutesPerPortion={prepMinutesPerPortion}
                onTap={() => router.push(`/order-aktif/${order.id}`)}
                onCancelled={() => router.refresh()}
              />
            ))
          )}
        </Card>

        {unpaidServed.length > 0 && (
          <div className="mt-3">
            <h2 className="text-ink-muted mb-1.5 text-sm font-bold uppercase tracking-wide">
              Sudah Disajikan · Menunggu Bayar
            </h2>
            <Card>
              {unpaidServed.map((order) => (
                <div key={order.id} className="border-border flex items-center border-b last:border-b-0">
                  <ListRow onClick={() => router.push(`/order-aktif/${order.id}`)} dense noDivider className="min-w-0 flex-1">
                    <span className="w-14 shrink-0 text-lg font-bold text-ink">
                      {formatQueueLabel(order.queueNumber, order.queueSuffix)}
                    </span>
                    <span className="text-ink flex-1 text-sm font-semibold">
                      {order.channel === "DINE_IN" ? order.tableLabel : CHANNEL_LABEL[order.channel]}
                    </span>
                  </ListRow>
                  <CancelOrderButton
                    compact
                    orderId={order.id}
                    orderLabel={formatQueueLabel(order.queueNumber, order.queueSuffix)}
                    onCancelled={() => router.refresh()}
                  />
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
