import type { ChannelBreakdownRow } from "@/lib/dashboard/get-channel-breakdown";
import { Card } from "@/components/ui/card";
import { PriceText } from "@/components/ui/price-text";
import { DASHBOARD_WINDOW_DAYS } from "@/lib/dashboard/config";

const CHANNEL_LABEL: Record<ChannelBreakdownRow["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

// Section 5. PAID orders only, same rolling window as sections 3-4.
export function ChannelBreakdownSection({ rows }: { rows: ChannelBreakdownRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.omzet, 0);

  return (
    <section>
      <h2 className="text-ink mb-2 text-base font-bold">Per Channel ({DASHBOARD_WINDOW_DAYS} hari)</h2>
      <Card>
        <div className="divide-border divide-y">
          {rows.map((row) => {
            const pct = total > 0 ? Math.round((row.omzet / total) * 100) : 0;
            return (
              <div key={row.channel} className="px-4 py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-ink text-sm font-semibold">{CHANNEL_LABEL[row.channel]}</span>
                  <PriceText amount={row.omzet} weight="secondary" />
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-pill">
                  <div className="bg-primary h-full rounded-pill" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-ink-faint mt-1 text-xs">
                  {row.orderCount} order · {pct}%
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
