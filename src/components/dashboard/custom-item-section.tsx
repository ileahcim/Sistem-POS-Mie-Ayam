"use client";

import { useState } from "react";
import Link from "next/link";
import type { CustomItemGroup } from "@/lib/dashboard/aggregate-sales";
import { Card } from "@/components/ui/card";
import { PriceText } from "@/components/ui/price-text";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { formatRupiah } from "@/lib/printing/format";

function formatDay(day: string): string {
  // Noon UTC so formatId (Asia/Jakarta) can't roll into the neighbouring day.
  const [y, m, d] = day.split("-").map(Number);
  return formatId(new Date(Date.UTC(y, m - 1, d, 5)), { day: "numeric", month: "short", year: "numeric" });
}

function formatPriceRange(min: number, max: number): string {
  return min === max ? formatRupiah(min) : `${formatRupiah(min)}–${formatRupiah(max)}`;
}

// A name typed into "+ Item Custom" repeatedly is a candidate for a real,
// fixed menu item (CLAUDE.md "+ Item Custom") — grouped by the typed name
// (aggregate-sales.ts), most-used first. Tap a name to see which orders
// used it; tap an order to open its read-only detail (Riwayat Pesanan),
// same as every other order link in the app. Nothing here writes anything —
// this is purely a lihat feature, like the rest of the Dashboard.
export function CustomItemSection({ groups, rangeLabel }: { groups: CustomItemGroup[]; rangeLabel: string }) {
  const [openName, setOpenName] = useState<string | null>(null);

  return (
    <section>
      <h2 className="text-ink mb-2 text-base font-bold">Item Custom ({rangeLabel})</h2>
      <Card>
        {groups.length === 0 ? (
          <p className="text-ink-faint py-8 text-center text-sm">Belum ada item custom di periode ini.</p>
        ) : (
          <div className="divide-border divide-y">
            {groups.map((g) => {
              const open = openName === g.name;
              return (
                <div key={g.name}>
                  <button
                    type="button"
                    onClick={() => setOpenName(open ? null : g.name)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-ink truncate text-sm font-semibold">{g.name}</span>
                      <p className="text-ink-faint text-xs">
                        {g.count}x dipakai · {formatPriceRange(g.minPrice, g.maxPrice)}
                      </p>
                    </div>
                    <PriceText amount={g.totalValue} weight="secondary" />
                  </button>
                  {open && (
                    <div className="bg-canvas border-border border-t px-4 py-1">
                      <div className="divide-border divide-y">
                        {g.orders.map((o) => (
                          <Link
                            key={o.orderId}
                            href={`/riwayat-pesanan/${o.orderId}`}
                            className="flex items-center justify-between gap-3 py-2.5 text-sm"
                          >
                            <span className="text-ink-muted">
                              {formatQueueLabel(o.queueNumber, o.queueSuffix)} · No. {o.orderNumber} ·{" "}
                              {formatDay(o.day)}
                            </span>
                            <span className="text-ink font-semibold tabular-nums">{formatRupiah(o.lineTotal)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
