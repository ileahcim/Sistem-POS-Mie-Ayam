"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderHistoryRow, OrderHistoryFilter } from "@/lib/orders/get-order-history";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NoHistoryIcon } from "@/components/ui/empty-state-icons";
import { AppHeader } from "@/components/ui/app-header";
import { orderTimesLabel } from "@/lib/orders/order-times";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { normalizeRange, type DateRange } from "@/lib/date-range/presets";
import { DateRangePresets } from "@/components/ui/date-range-presets";

const CHANNEL_LABEL: Record<OrderHistoryRow["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

const STATUS_LABEL: Record<OrderHistoryRow["status"], string> = {
  PAID: "Lunas",
  VOID: "Void",
  RECEIVABLE: "Piutang",
  CANCELLED: "Batal",
};

const STATUS_VARIANT: Record<OrderHistoryRow["status"], BadgeVariant> = {
  PAID: "success",
  VOID: "danger",
  RECEIVABLE: "warning",
  CANCELLED: "neutral",
};

// CASHIER's date inputs and quick-range chips never render at all (not just
// disabled) — the server (get-order-history.ts's clampHistoryFilterForRole)
// already forces the query to today regardless of URL params, so this is
// purely "don't show controls that couldn't do anything" UX, not the actual
// boundary. A cashier session that hand-edits ?from=/&to= still gets today.
//
// `today` comes from the server as a Jakarta calendar date (page.tsx's
// localDateStr), never from the browser clock — the presets are built from
// it, so a tablet with a wrong timezone can't shift what "Hari ini" means.
export function RiwayatPesananScreen({
  orders,
  filter,
  isOwner,
  today,
  nav,
}: {
  orders: OrderHistoryRow[];
  filter: OrderHistoryFilter;
  isOwner: boolean;
  today: string;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(filter.dateFrom);
  const [dateTo, setDateTo] = useState(filter.dateTo);
  const [search, setSearch] = useState(filter.search);

  function pushFilter(range: DateRange, searchText: string) {
    const params = new URLSearchParams();
    if (isOwner) {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    if (searchText.trim()) params.set("q", searchText.trim());
    router.push(`/riwayat-pesanan?${params.toString()}`);
  }

  function applyFilter() {
    pushFilter(normalizeRange({ from: dateFrom, to: dateTo }), search);
  }

  // A preset is a complete answer on its own, so it applies straight away
  // instead of making the owner tap "Cari" afterwards.
  function applyPreset(range: DateRange) {
    setDateFrom(range.from);
    setDateTo(range.to);
    pushFilter(range, search);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title="Riwayat Pesanan" />

      <div className="border-border bg-surface flex flex-col gap-2 border-b px-4 py-3">
        {isOwner && <DateRangePresets today={today} value={{ from: dateFrom, to: dateTo }} onPick={applyPreset} />}
        <div className="flex flex-wrap items-end gap-2">
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
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          {orders.length === 0 ? (
            <EmptyState
              icon={<NoHistoryIcon />}
              title="Belum ada riwayat di rentang ini"
              description="Order yang sudah lunas, batal, void, atau piutang akan muncul di sini."
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
                    {/* Came from Pesanan Terjadwal — a different path (taken
                        the night before, delivered later), so it must be
                        traceable at a glance. */}
                    {order.scheduledFor && <Badge variant="info">Pre-order</Badge>}
                  </div>
                  {/* Wraps instead of truncating: the "Dibayar" half is the
                      part that matters when tracing an order, and it's last. */}
                  <span className="text-ink-faint text-xs">
                    No. Order {order.orderNumber} · {orderTimesLabel(order)}
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
