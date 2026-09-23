import type { MarginReport, LowMarginItem } from "@/lib/dashboard/aggregate-sales";
import { Card } from "@/components/ui/card";
import { PriceText } from "@/components/ui/price-text";
import { Badge } from "@/components/ui/badge";

// Section 4. Margin comes purely from the costPrice SNAPSHOT on each sold
// line (see aggregate-sales.ts's computeMarginReport) — costPrice starts at
// 0/unset for every product until the owner fills it in manually (CLAUDE.md
// "Order & status"), so an unlabeled margin number here would silently read
// as "this barely makes money" when it might just mean "HPP was never
// entered." The warning banner and the per-product badge exist specifically
// so that's never ambiguous. Follows the same shared date-range filter as
// Menu & Topping Terlaris and Per Channel (23 Sep 2026 — used to be locked
// to a fixed 30-day window while the others were too; see
// sales-report-section.tsx for the shared control).
export function MarginSection({
  report,
  lowMarginItems,
  rangeLabel,
}: {
  report: MarginReport;
  lowMarginItems: LowMarginItem[];
  rangeLabel: string;
}) {
  return (
    <section>
      <h2 className="text-ink mb-2 text-base font-bold">Margin ({rangeLabel})</h2>

      {report.anyMissingCostPrice && (
        <div className="bg-warning-soft text-warning mb-3 rounded-card px-3 py-2 text-sm font-medium">
          Sebagian produk belum diisi HPP (costPrice) — HPP dihitung sebagai 0 untuk yang belum diisi, jadi
          margin di bawah ini kemungkinan LEBIH TINGGI dari untung sebenarnya, bukan patokan pasti.
        </div>
      )}

      {/* "+ Item Custom" lines (22 Sep 2026) never appear in the table below
          them — they have no real HPP to snapshot, so blending them in would
          make margin% look better than it really is. Shown here instead, so
          the owner can still see how much custom-priced selling happened. */}
      {report.customItemCount > 0 && (
        <div className="bg-info-soft text-info mb-3 rounded-card px-3 py-2 text-sm font-medium">
          {report.customItemCount} item custom (harga diketik manual, total{" "}
          {report.customItemOmzet.toLocaleString("id-ID")}) di luar hitungan margin ini — cek Riwayat Pesanan
          untuk lihat order mana.
        </div>
      )}

      <Card padded className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-ink-muted text-xs">Omzet</p>
          <PriceText amount={report.totalOmzet} weight="primary" />
        </div>
        <div>
          <p className="text-ink-muted text-xs">HPP Tercatat</p>
          <PriceText amount={report.totalHpp} weight="primary" />
        </div>
        <div>
          <p className="text-ink-muted text-xs">Margin</p>
          <PriceText amount={report.totalMargin} weight="primary" />
        </div>
      </Card>

      <Card>
        {report.byProduct.length === 0 ? (
          <p className="text-ink-faint py-8 text-center text-sm">Belum ada penjualan.</p>
        ) : (
          <div className="divide-border divide-y">
            {report.byProduct.map((row) => (
              <div key={row.productName} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-ink truncate text-sm font-semibold">{row.productName}</span>
                    {row.hasMissingCostPrice && <Badge variant="warning">HPP belum diisi</Badge>}
                  </div>
                  <span className="text-ink-faint text-xs">{row.qty}x terjual</span>
                </div>
                <PriceText amount={row.margin} weight="secondary" />
              </div>
            ))}
          </div>
        )}
      </Card>

      {lowMarginItems.length > 0 && (
        <div className="mt-3">
          <h3 className="text-ink-muted mb-1.5 text-sm font-bold uppercase tracking-wide">
            Margin Rendah / Rugi ({rangeLabel})
          </h3>
          <Card>
            <div className="divide-border divide-y">
              {lowMarginItems.map((row) => (
                <div key={`${row.kind}:${row.name}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-ink truncate text-sm font-semibold">{row.name}</span>
                      <Badge variant={row.totalMargin < 0 ? "danger" : "warning"}>{row.marginPercent}%</Badge>
                    </div>
                    <span className="text-ink-faint text-xs">
                      {row.kind === "addon" ? "Add-on" : "Produk"} · {row.qty}x terjual
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={row.totalMargin < 0 ? "text-danger text-sm font-bold" : "text-warning text-sm font-bold"}>
                      {row.totalMargin < 0 ? "Rugi " : "Untung tipis "}
                      Rp{Math.abs(row.totalMargin).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
