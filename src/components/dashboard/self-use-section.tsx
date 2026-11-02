import type { SelfUseSummary } from "@/lib/stock/types";
import { Card } from "@/components/ui/card";
import { formatRupiah } from "@/lib/printing/format";

// "Es krim diambil sendiri" (docs/spec-es-krim.md) — what the family took
// from the freezer, valued at modal per pcs. Never a sale: it is not in
// omzet, margin or any shift/cash number; this is the only place it shows.
export function SelfUseSection({ summary, rangeLabel }: { summary: SelfUseSummary; rangeLabel: string }) {
  return (
    <section>
      <h2 className="text-ink mb-2 text-base font-bold">Es Krim Diambil Sendiri ({rangeLabel})</h2>
      <Card padded>
        <p className="text-ink text-base">
          Es krim diambil sendiri: <b>{summary.qty} pcs</b>, senilai <b>{formatRupiah(summary.value)}</b>
        </p>
        <p className="text-ink-muted mt-1 text-sm">Dihitung dari modal per pcs. Tidak masuk penjualan maupun kas.</p>
        {summary.missingCost && (
          <p className="text-warning mt-1 text-sm">Sebagian produk belum punya modal per pcs — nilainya dihitung Rp0.</p>
        )}
        {summary.byProduct.length > 0 && (
          <ul className="divide-border mt-3 divide-y">
            {summary.byProduct.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-ink">{p.name}</span>
                <span className="text-ink-muted tabular-nums">
                  {p.qty} pcs · {formatRupiah(p.value)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
