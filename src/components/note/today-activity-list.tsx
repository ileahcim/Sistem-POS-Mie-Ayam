"use client";

import Link from "next/link";
import type { TodayActivityRow } from "@/lib/note/today-activity";
import { formatRupiah } from "@/lib/printing/format";
import { Badge } from "@/components/ui/badge";

// "Aktivitas Hari Ini" — the third view of the /note and /note/frozen lists
// (shared by both books). Every row opens the customer's page, exactly like
// a row of the customer list. Money totals on top are plain sums of the rows
// shown — a quick check of "what came in today", not a report (Ringkasan is).
export function TodayActivityList({
  rows,
  customerHref,
  query,
}: {
  rows: TodayActivityRow[];
  customerHref: (customerId: string) => string;
  query: string;
}) {
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.customerName.toLowerCase().includes(q)) : rows;
  const orders = shown.filter((r) => r.kind === "ORDER");
  const payments = shown.filter((r) => r.kind === "PAYMENT");
  const orderLabel = rows.find((r) => r.kind === "ORDER")?.kindLabel ?? "Pesanan";

  if (rows.length === 0) {
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
        </span>
      </div>
      {shown.map((r) => (
        <Link
          key={r.id}
          href={customerHref(r.customerId)}
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 border-b px-4 py-2 last:border-b-0"
        >
          <span className="text-ink-muted w-12 shrink-0 text-sm tabular-nums">{r.time}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-ink truncate text-base font-semibold">{r.customerName}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <Badge variant={r.kind === "PAYMENT" ? "success" : "info"}>{r.kindLabel}</Badge>
              {r.detail && <span className="text-ink-muted truncate text-xs">{r.detail}</span>}
            </span>
          </span>
          <span className="text-ink shrink-0 text-base font-semibold tabular-nums">{formatRupiah(r.amount)}</span>
        </Link>
      ))}
    </div>
  );
}
