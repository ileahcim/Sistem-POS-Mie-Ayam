import type { ShiftHistoryRow } from "@/lib/dashboard/get-shift-history";
import type { OmzetShiftPoint } from "@/lib/dashboard/get-omzet-history";
import type { TopItemRow } from "@/lib/dashboard/get-top-items";
import type { MarginReport } from "@/lib/dashboard/get-margin-report";
import type { ChannelBreakdownRow } from "@/lib/dashboard/get-channel-breakdown";
import type { ReceivableOrder } from "@/lib/orders/get-receivable-orders";
import { LinkButton } from "@/components/ui/link-button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ShiftHistorySection } from "./shift-history-section";
import { OmzetSection } from "./omzet-section";
import { TopItemsSection } from "./top-items-section";
import { MarginSection } from "./margin-section";
import { ChannelBreakdownSection } from "./channel-breakdown-section";
import { PiutangSection } from "./piutang-section";

// Sections render top-to-bottom in the exact priority order the owner
// asked for — the one checked most often (shift history/selisih) is the
// first thing visible, no scrolling needed to reach it. This screen is
// used sitting down (dashboard/laporan — see CLAUDE.md "Kepadatan layar"),
// so it deliberately does NOT get the Kasir/Order Aktif density treatment.
export function DashboardScreen({
  shifts,
  omzetHistory,
  topProducts,
  topToppings,
  marginReport,
  channelBreakdown,
  receivables,
}: {
  shifts: ShiftHistoryRow[];
  omzetHistory: OmzetShiftPoint[];
  topProducts: TopItemRow[];
  topToppings: TopItemRow[];
  marginReport: MarginReport;
  channelBreakdown: ChannelBreakdownRow[];
  receivables: ReceivableOrder[];
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/dashboard/export"
            className="rounded-pill bg-muted flex h-12 items-center px-4 text-sm font-semibold text-ink"
          >
            Export Excel
          </a>
          <LinkButton href="/kasir" variant="secondary">Ke Kasir</LinkButton>
          <SignOutButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <ShiftHistorySection shifts={shifts} />
          <OmzetSection history={omzetHistory} />
          <TopItemsSection products={topProducts} toppings={topToppings} />
          <MarginSection report={marginReport} />
          <ChannelBreakdownSection rows={channelBreakdown} />
          <PiutangSection orders={receivables} />
        </div>
      </div>
    </div>
  );
}
