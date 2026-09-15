import type { ReceivableOrder } from "@/lib/orders/get-receivable-orders";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(iso));
}

export function PiutangList({ orders }: { orders: ReceivableOrder[] }) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Piutang</h1>
        <LinkButton href="/kasir" variant="secondary">Ke Kasir</LinkButton>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          {orders.length === 0 ? (
            <p className="text-ink-faint py-12 text-center">Tidak ada piutang.</p>
          ) : (
            orders.map((order) => (
              <ListRow key={order.id} roomy asLink={`/pembayaran/${order.id}`}>
                <span className="w-12 shrink-0 text-lg font-bold text-ink">#{order.queueNumber}</span>
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
