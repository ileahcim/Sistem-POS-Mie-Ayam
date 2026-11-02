import Link from "next/link";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { StockHistoryRow } from "@/lib/stock/get-ice-cream";
import { STOCK_KIND_LABEL, type StockKind } from "@/lib/stock/types";
import { AppHeader } from "@/components/ui/app-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/printing/format";

const KIND_BADGE: Record<StockKind, BadgeVariant> = {
  RESTOCK: "success",
  SALE: "neutral",
  SALE_RETURN: "info",
  CORRECTION: "warning",
  SELF_USE: "danger",
};

function detailOf(row: StockHistoryRow): string | null {
  switch (row.kind) {
    case "RESTOCK":
      return [
        row.boxes != null && row.unitsPerBox != null ? `${row.boxes} box × ${row.unitsPerBox} pcs` : null,
        row.boxPrice != null ? `${formatRupiah(row.boxPrice)}/box` : null,
        row.note,
      ]
        .filter(Boolean)
        .join(" · ");
    case "SELF_USE":
      return [row.takenBy ? `Diambil: ${row.takenBy}` : null, row.note].filter(Boolean).join(" · ") || null;
    default:
      return row.note;
  }
}

// Server-rendered, read-only list (newest first) — stockAfter is stored on
// every row, so the running stock column needs no re-summing.
export function StockHistoryScreen({
  product,
  rows,
  nav,
}: {
  product: { id: string; name: string; stock: number };
  rows: StockHistoryRow[];
  nav: HeaderNav;
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title={`Riwayat ${product.name}`}
        subtitle={`Stok sekarang ${product.stock} pcs`}
        actions={
          <LinkButton href="/es-krim" variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <Card>
            {rows.length === 0 ? (
              <p className="text-ink-faint px-4 py-6 text-center text-sm">Belum ada riwayat.</p>
            ) : (
              rows.map((row) => {
                const detail = detailOf(row);
                return (
                  <div key={row.id} className="border-border flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={KIND_BADGE[row.kind]}>{STOCK_KIND_LABEL[row.kind]}</Badge>
                        <span className="text-ink-muted text-xs">{row.dateLabel}</span>
                      </div>
                      {row.orderLabel &&
                        (row.orderId ? (
                          <Link href={`/riwayat-pesanan/${row.orderId}`} className="text-info mt-1 inline-flex min-h-12 items-center text-sm underline">
                            {row.orderLabel}
                          </Link>
                        ) : (
                          <p className="text-ink mt-1 text-sm">{row.orderLabel}</p>
                        ))}
                      {detail && <p className="text-ink mt-1 text-sm break-words">{detail}</p>}
                      <p className="text-ink-faint text-xs">oleh {row.userName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-lg font-bold tabular-nums ${row.qtyChange > 0 ? "text-primary-strong" : "text-danger"}`}>
                        {row.qtyChange > 0 ? `+${row.qtyChange}` : row.qtyChange}
                      </p>
                      <p className="text-ink-muted text-xs tabular-nums">sisa {row.stockAfter}</p>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
