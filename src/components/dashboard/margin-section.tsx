import type { MarginReport } from "@/lib/dashboard/get-margin-report";
import { Card } from "@/components/ui/card";
import { PriceText } from "@/components/ui/price-text";
import { Badge } from "@/components/ui/badge";
import { DASHBOARD_WINDOW_DAYS } from "@/lib/dashboard/config";

// Section 4. Margin comes purely from the costPrice SNAPSHOT on each sold
// line (see get-margin-report.ts) — costPrice starts at 0/unset for every
// product until the owner fills it in manually (CLAUDE.md "Order & status"),
// so an unlabeled margin number here would silently read as "this barely
// makes money" when it might just mean "HPP was never entered." The warning
// banner and the per-product badge exist specifically so that's never
// ambiguous.
export function MarginSection({ report }: { report: MarginReport }) {
  return (
    <section>
      <h2 className="text-ink mb-2 text-base font-bold">Margin ({DASHBOARD_WINDOW_DAYS} hari)</h2>

      {report.anyMissingCostPrice && (
        <div className="bg-warning-soft text-warning mb-3 rounded-card px-3 py-2 text-sm font-medium">
          Sebagian produk belum diisi HPP (costPrice) — margin di bawah ini kemungkinan lebih rendah dari
          keuntungan sebenarnya, bukan berarti benar-benar tipis.
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
    </section>
  );
}
