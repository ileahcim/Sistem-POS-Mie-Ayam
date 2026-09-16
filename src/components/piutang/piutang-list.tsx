import type { ReceivableOrder } from "@/lib/orders/get-receivable-orders";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";
import { EmptyState } from "@/components/ui/empty-state";
import { NoDebtIcon } from "@/components/ui/empty-state-icons";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";

function formatDate(iso: string): string {
  return formatId(new Date(iso), { dateStyle: "medium" });
}

export function PiutangList({
  orders,
  orderAktifIndicator,
}: {
  orders: ReceivableOrder[];
  orderAktifIndicator: OrderAktifIndicator;
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Piutang</h1>
        <div className="flex items-center gap-2">
          <OrderAktifButton
            activeCount={orderAktifIndicator.activeCount}
            lateCount={orderAktifIndicator.lateCount}
          />
          <LinkButton href="/kasir" variant="secondary">Ke Kasir</LinkButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          {orders.length === 0 ? (
            <EmptyState
              icon={<NoDebtIcon />}
              title="Tidak ada piutang"
              description="Semua order sudah lunas — belum ada yang ditandai piutang."
              actionHref="/kasir"
              actionLabel="Ke Kasir"
            />
          ) : (
            orders.map((order) => (
              <ListRow key={order.id} roomy asLink={`/pembayaran/${order.id}`}>
                <span className="w-14 shrink-0 text-lg font-bold text-ink">
                  {formatQueueLabel(order.queueNumber, order.queueSuffix)}
                </span>
                <span className="text-ink-muted flex-1 text-sm">
                  {order.customerName} · {formatDate(order.createdAt)}
                </span>
                <PriceText amount={order.total} weight="primary" />
              </ListRow>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
