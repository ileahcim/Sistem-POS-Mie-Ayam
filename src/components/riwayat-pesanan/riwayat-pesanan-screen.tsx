"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderHistoryRow, OrderHistoryFilter } from "@/lib/orders/get-order-history";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NoHistoryIcon } from "@/components/ui/empty-state-icons";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";

const CHANNEL_LABEL: Record<OrderHistoryRow["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

const STATUS_LABEL: Record<OrderHistoryRow["status"], string> = {
  PAID: "Lunas",
  VOID: "Void",
  RECEIVABLE: "Piutang",
};

const STATUS_VARIANT: Record<OrderHistoryRow["status"], BadgeVariant> = {
  PAID: "success",
  VOID: "danger",
  RECEIVABLE: "warning",
};

function formatDateTime(iso: string): string {
  return formatId(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
}

// CASHIER's date inputs never render at all (not just disabled) — the
// server (get-order-history.ts's clampHistoryFilterForRole) already forces
// the query to today regardless of URL params, so this is purely "don't
// show controls that couldn't do anything" UX, not the actual boundary.
export function RiwayatPesananScreen({
  orders,
  filter,
  isOwner,
  orderAktifIndicator,
}: {
  orders: OrderHistoryRow[];
  filter: OrderHistoryFilter;
  isOwner: boolean;
  orderAktifIndicator: OrderAktifIndicator;
}) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(filter.dateFrom);
  const [dateTo, setDateTo] = useState(filter.dateTo);
  const [search, setSearch] = useState(filter.search);

  function applyFilter() {
    const params = new URLSearchParams();
    if (isOwner) {
      params.set("from", dateFrom);
      params.set("to", dateTo);
    }
    if (search.trim()) params.set("q", search.trim());
    router.push(`/riwayat-pesanan?${params.toString()}`);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Riwayat Pesanan</h1>
        <div className="flex items-center gap-2">
          <OrderAktifButton
            activeCount={orderAktifIndicator.activeCount}
            lateCount={orderAktifIndicator.lateCount}
          />
          <LinkButton href="/kasir" variant="secondary">Ke Kasir</LinkButton>
        </div>
      </div>

      <div className="border-border bg-surface flex flex-wrap items-end gap-2 border-b px-4 py-3">
        {isOwner && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted font-medium">Dari</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted font-medium">Sampai</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>
          </>
        )}
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
          <span className="text-ink-muted font-medium">Cari no. order / nama tamu</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            placeholder="mis. 42 atau Budi"
            className="rounded-input border-border h-12 w-full border px-3 text-base"
          />
        </label>
        <Button variant="primary" onClick={applyFilter}>Cari</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          {orders.length === 0 ? (
            <EmptyState
              icon={<NoHistoryIcon />}
              title="Belum ada riwayat di rentang ini"
              description="Order yang sudah lunas, void, atau piutang akan muncul di sini."
              actionHref="/kasir"
              actionLabel="Ke Kasir"
            />
          ) : (
            orders.map((order) => (
              <ListRow key={order.id} roomy asLink={`/riwayat-pesanan/${order.id}`}>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-ink shrink-0 text-base font-bold">
                      {formatQueueLabel(order.queueNumber, order.queueSuffix)}
                    </span>
                    <span className="text-ink-muted truncate text-sm">
                      {CHANNEL_LABEL[order.channel]}
                      {order.tableLabel ? ` · ${order.tableLabel}` : ""}
                    </span>
                  </div>
                  <span className="text-ink-faint truncate text-xs">
                    No. Order {order.orderNumber} · {formatDateTime(order.createdAt)}
                    {order.customerName ? ` · ${order.customerName}` : ""}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <PriceText amount={order.total} weight="primary" />
                  <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                </div>
              </ListRow>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
