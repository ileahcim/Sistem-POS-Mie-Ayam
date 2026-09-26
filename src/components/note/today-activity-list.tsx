"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  groupTodayActivity,
  type TodayActivity,
  type TodayActivityRow,
  type TodayCustomerGroup,
} from "@/lib/note/today-activity";
import { formatRupiah } from "@/lib/printing/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/components/ui/cn";

// Note's Hari Ini list (shared by both books): ONE ROW PER CUSTOMER with
// activity today — their pesanan/pengambilan of today, how today's money
// reads (splitTodayPayment: today's orders first, then "Cicil utang lama")
// and what they owe now. The colour follows the customer's TOTAL balance
// (todayCustomerStatus): LUNAS solid green and moved to the bottom, KURANG
// (paid today, still owes) soft yellow, BELUM BAYAR plain.
//
// Tapping a row expands it in place to that customer's transactions of
// today, each with Edit/Hapus (the book's own entry sheet — the same edit/
// delete path as the customer page and Ringkasan), plus a separate button
// to the customer's page. The row header is a <button>; the Edit/Hapus/link
// targets are siblings below it, never nested inside it.
//
// The money totals on top are plain sums of the transactions shown — a quick
// check of "what came in today", not a report (Ringkasan is).
// `highlightId` is the entry just saved: its customer's row gets a brief
// green tint (NoteTodayPanel clears it after a moment; the colour fades).
export function TodayActivityList<E>({
  activity,
  unit,
  customerHref,
  query,
  highlightId = null,
  onEdit,
  onDelete,
}: {
  activity: TodayActivity<E>;
  unit: "kg" | "pcs";
  customerHref: (customerId: string) => string;
  query: string;
  highlightId?: string | null;
  onEdit: (entry: E) => void;
  onDelete: (entry: E) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const groups = useMemo(() => groupTodayActivity(activity), [activity]);
  const q = query.trim().toLowerCase();
  const shown = q ? groups.filter((g) => g.customerName.toLowerCase().includes(q)) : groups;
  const shownRows = shown.flatMap((g) => g.rows);
  const orders = shownRows.filter((r) => r.kind === "ORDER");
  const payments = shownRows.filter((r) => r.kind === "PAYMENT");
  const orderLabel = activity.rows.find((r) => r.kind === "ORDER")?.kindLabel ?? (unit === "pcs" ? "Pengambilan" : "Pesanan");
  // Where today's money went (splitTodayPayment) — only spelled out when some
  // of it paid old debt or was overpaid, otherwise it all went to today.
  const payForToday = shown.reduce((s, g) => s + g.payForToday, 0);
  const payForOld = shown.reduce((s, g) => s + g.payForOld, 0);
  const payExcess = shown.reduce((s, g) => s + g.payExcess, 0);
  const paymentParts =
    payForOld > 0 || payExcess > 0
      ? [
          payForToday > 0 && `${formatRupiah(payForToday)} untuk ${orderLabel.toLowerCase()} hari ini`,
          payForOld > 0 && `${formatRupiah(payForOld)} cicil utang lama`,
          payExcess > 0 && `${formatRupiah(payExcess)} lebih bayar`,
        ].filter((x): x is string => Boolean(x))
      : [];
  const highlightCustomer = highlightId ? activity.rows.find((r) => r.id === highlightId)?.customerId ?? null : null;

  // A paid-up customer's row sits at the bottom, possibly below the fold —
  // bring the row just saved into view so whoever recorded it sees it land.
  const highlightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightCustomer]);

  function toggle(customerId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  if (activity.rows.length === 0) {
    return <p className="text-ink-faint p-6 text-center text-sm">Belum ada pesanan atau pembayaran yang dicatat hari ini.</p>;
  }
  if (shown.length === 0) {
    return <p className="text-ink-faint p-6 text-center text-sm">Tidak ada aktivitas hari ini untuk “{query}”.</p>;
  }
  return (
    <div className="flex flex-col">
      <div className="border-border text-ink-muted flex flex-wrap gap-x-4 gap-y-1 border-b px-4 py-3 text-sm">
        <span>
          {orderLabel}: <strong className="text-ink">{orders.length}</strong> · {formatRupiah(orders.reduce((s, r) => s + r.amount, 0))}
        </span>
        <span>
          Pembayaran: <strong className="text-ink">{payments.length}</strong> ·{" "}
          {formatRupiah(payments.reduce((s, r) => s + r.amount, 0))}
          {paymentParts.length > 0 && ` (${paymentParts.join(", ")})`}
        </span>
      </div>
      {shown.map((g) => (
        <CustomerRow
          key={g.customerId}
          ref={g.customerId === highlightCustomer ? highlightRef : undefined}
          group={g}
          unit={unit}
          orderLabel={orderLabel}
          open={expanded.has(g.customerId)}
          highlighted={g.customerId === highlightCustomer}
          onToggle={() => toggle(g.customerId)}
          customerHref={customerHref(g.customerId)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function formatQty(qty: number, unit: "kg" | "pcs"): string {
  return `${(Math.round(qty * 100) / 100).toLocaleString("id-ID")} ${unit}`;
}

function CustomerRow<E>({
  ref,
  group: g,
  unit,
  orderLabel,
  open,
  highlighted,
  onToggle,
  customerHref,
  onEdit,
  onDelete,
}: {
  ref?: React.Ref<HTMLDivElement>;
  group: TodayCustomerGroup<E>;
  unit: "kg" | "pcs";
  orderLabel: string;
  open: boolean;
  highlighted: boolean;
  onToggle: () => void;
  customerHref: string;
  onEdit: (entry: E) => void;
  onDelete: (entry: E) => void;
}) {
  const lunas = g.status === "LUNAS";
  const panelId = `today-${g.customerId}`;
  return (
    <div
      ref={ref}
      data-customer-id={g.customerId}
      data-status={g.status}
      aria-current={highlighted ? "true" : undefined}
      className="border-border border-b last:border-b-0"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left transition-[background-color,box-shadow] duration-1000",
          lunas
            ? "bg-primary-strong text-white"
            : highlighted
              ? "bg-primary-soft"
              : g.status === "KURANG"
                ? "bg-warning-soft"
                : "hover:bg-muted",
          highlighted && (lunas ? "ring-primary-soft ring-4 ring-inset" : "ring-primary ring-4 ring-inset"),
        )}
      >
        <span aria-hidden className={cn("w-4 shrink-0 text-sm", lunas ? "text-white" : "text-ink-muted")}>
          {open ? "▾" : "▸"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("truncate text-base font-semibold", lunas ? "text-white" : "text-ink")}>{g.customerName}</span>
          <span className={cn("flex flex-wrap gap-x-3 text-xs", lunas ? "text-white/90" : "text-ink-muted")}>
            {g.orderCount > 0 && (
              <span data-testid="today-orders">
                {orderLabel} {formatQty(g.orderQty, unit)} · {formatRupiah(g.orderAmount)}
                {g.todayShort === 0 && (g.paymentCount > 0 || lunas) && " · Lunas"}
                {g.todayShort > 0 && g.paymentCount > 0 && ` · kurang ${formatRupiah(g.todayShort)}`}
              </span>
            )}
            {g.payForOld > 0 && <span data-testid="today-old-payment">Cicil utang lama {formatRupiah(g.payForOld)}</span>}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end" data-testid="today-balance">
          {lunas ? (
            <>
              <span className="text-base font-bold text-white">Lunas</span>
              {g.balance < 0 && <span className="text-xs text-white/90">Lebih bayar {formatRupiah(-g.balance)}</span>}
            </>
          ) : g.status === "KURANG" && g.todayShort > 0 && g.oldRemaining === 0 ? (
            <span className="text-ink text-base font-bold tabular-nums">Kurang {formatRupiah(g.balance)}</span>
          ) : g.status === "KURANG" && g.todayShort === 0 ? (
            // Today is settled; what's left is from before — not "Kurang",
            // which would read as if today's order were short.
            <>
              <span className="text-ink-muted text-xs">Sisa utang lama</span>
              <span className="text-ink text-base font-bold tabular-nums">{formatRupiah(g.balance)}</span>
            </>
          ) : (
            <>
              <span className="text-ink-muted text-xs">Sisa utang</span>
              <span className="text-ink text-base font-bold tabular-nums">{formatRupiah(g.balance)}</span>
            </>
          )}
        </span>
      </button>

      {open && (
        <div id={panelId} className="bg-surface flex flex-col">
          {g.rows.map((r) => (
            <TransactionRow key={r.id} row={r} customerName={g.customerName} onEdit={onEdit} onDelete={onDelete} />
          ))}
          <div className="border-border border-t px-4 py-3">
            <LinkButton href={customerHref} variant="secondary" size="compact" className="border-border border">
              Buka detail pelanggan
            </LinkButton>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionRow<E>({
  row: r,
  customerName,
  onEdit,
  onDelete,
}: {
  row: TodayActivityRow<E>;
  customerName: string;
  onEdit: (entry: E) => void;
  onDelete: (entry: E) => void;
}) {
  const what = `${customerName} ${r.kindLabel} ${formatRupiah(r.amount)} jam ${r.time}`;
  return (
    <div
      data-entry-id={r.id}
      className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-2 pr-4 pl-11"
    >
      <span className="text-ink-muted w-12 shrink-0 text-sm tabular-nums">{r.time}</span>
      <span className="flex min-w-0 flex-1 basis-32 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <Badge variant={r.kind === "PAYMENT" ? "success" : "info"}>{r.kindLabel}</Badge>
        </span>
        {r.detail && <span className="text-ink-muted truncate text-xs">{r.detail}</span>}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <span className="text-ink text-base font-semibold tabular-nums">{formatRupiah(r.amount)}</span>
        <Button variant="secondary" size="compact" onClick={() => onEdit(r.entry)} aria-label={`Edit ${what}`}>
          Edit
        </Button>
        <Button variant="danger" size="compact" onClick={() => onDelete(r.entry)} aria-label={`Hapus ${what}`}>
          Hapus
        </Button>
      </span>
    </div>
  );
}
