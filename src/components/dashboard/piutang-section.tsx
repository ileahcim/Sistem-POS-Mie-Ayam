import Link from "next/link";
import type { ReceivableOrder } from "@/lib/orders/get-receivable-orders";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";

function formatDate(iso: string): string {
  return formatId(new Date(iso), { dateStyle: "medium" });
}

// Section 6 — reads the same data as the standalone /piutang page (which
// stays the place to actually collect a payment, via its existing link to
// /pembayaran/[id]) so there's exactly one source of truth for what counts
// as an outstanding receivable.
export function PiutangSection({ orders }: { orders: ReceivableOrder[] }) {
  const total = orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-ink text-base font-bold">Piutang Belum Lunas</h2>
        {orders.length > 0 && <PriceText amount={total} weight="primary" />}
      </div>
      <Card>
        {orders.length === 0 ? (
          <p className="text-ink-faint py-8 text-center text-sm">Tidak ada piutang.</p>
        ) : (
          orders.map((order) => (
            <ListRow key={order.id} asLink={`/pembayaran/${order.id}`}>
              <span className="w-14 shrink-0 text-lg font-bold text-ink">
                {formatQueueLabel(order.queueNumber, order.queueSuffix)}
              </span>
              <span className="text-ink-muted flex-1 text-sm">
                {order.customerName} · {formatDate(order.createdAt)}
              </span>
              <PriceText amount={order.total} weight="secondary" />
            </ListRow>
          ))
        )}
      </Card>
      <div className="mt-2 text-right">
        <Link href="/piutang" className="text-primary-strong text-sm font-medium">
          Lihat halaman Piutang →
        </Link>
      </div>
    </section>
  );
}
