"use client";

import { useRouter } from "next/navigation";
import type { PreOrderSummary } from "@/lib/orders/get-preorders";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";
import { NoScheduleIcon } from "@/components/ui/empty-state-icons";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { formatId } from "@/lib/timezone";

const CHANNEL_LABEL: Record<PreOrderSummary["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

function formatScheduledFor(iso: string): string {
  return formatId(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
}

// Pre-orders not yet due — see CLAUDE.md "Pre-order". Reachable without an
// open shift on purpose (bulk WhatsApp orders come in at night, warung
// closed) — this page and "+ Buat Pre-order" never check shift state.
export function PesananTerjadwalList({
  orders,
  orderAktifIndicator,
}: {
  orders: PreOrderSummary[];
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const router = useRouter();

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Pesanan Terjadwal</h1>
        <div className="flex flex-wrap items-center gap-2">
          <OrderAktifButton
            activeCount={orderAktifIndicator.activeCount}
            lateCount={orderAktifIndicator.lateCount}
          />
          <LinkButton href="/pesanan-terjadwal/baru" variant="primary">+ Buat Pre-order</LinkButton>
          <SignOutButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          {orders.length === 0 ? (
            <EmptyState
              icon={<NoScheduleIcon />}
              title="Belum ada pesanan terjadwal"
              description="Pre-order yang belum jatuh tempo (mis. pesanan WhatsApp untuk besok) muncul di sini."
              actionHref="/kasir"
              actionLabel="Ke Kasir"
            />
          ) : (
            orders.map((order) => (
              <ListRow key={order.id} onClick={() => router.push(`/order-aktif/${order.id}`)} roomy>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-ink text-sm font-bold">{formatScheduledFor(order.scheduledFor)}</span>
                    {order.status === "PAID" && <Badge variant="success">Lunas</Badge>}
                  </div>
                  <div className="text-ink-muted text-sm">
                    {order.customerName ?? "(tanpa nama)"} ·{" "}
                    {order.channel === "DINE_IN" ? order.tableLabel : CHANNEL_LABEL[order.channel]}
                  </div>
                  <div className="text-ink-muted truncate text-sm">{order.itemSummary}</div>
                </div>
              </ListRow>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
