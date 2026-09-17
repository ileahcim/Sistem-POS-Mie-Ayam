import type { ShiftHistoryRow } from "@/lib/dashboard/get-shift-history";
import type { OmzetShiftPoint } from "@/lib/dashboard/get-omzet-history";
import type { TopItemRow } from "@/lib/dashboard/get-top-items";
import type { MarginReport } from "@/lib/dashboard/get-margin-report";
import type { LowMarginItem } from "@/lib/dashboard/get-low-margin-items";
import type { ChannelBreakdownRow } from "@/lib/dashboard/get-channel-breakdown";
import type { ReceivableOrder } from "@/lib/orders/get-receivable-orders";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { FadeIn } from "@/components/ui/fade-in";
import { AppHeader } from "@/components/ui/app-header";
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
  lowMarginItems,
  channelBreakdown,
  receivables,
  nav,
}: {
  shifts: ShiftHistoryRow[];
  omzetHistory: OmzetShiftPoint[];
  topProducts: TopItemRow[];
  topToppings: TopItemRow[];
  marginReport: MarginReport;
  lowMarginItems: LowMarginItem[];
  channelBreakdown: ChannelBreakdownRow[];
  receivables: ReceivableOrder[];
  nav: HeaderNav;
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Dashboard"
        actions={
          <a
            href="/dashboard/export"
            className="rounded-pill bg-muted hidden h-12 items-center px-4 text-sm font-semibold whitespace-nowrap text-ink sm:flex"
          >
            Export Excel
          </a>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {/* Phone width: the header row has no room left, so the export
              button moves to the top of the page instead of disappearing. */}
          <a
            href="/dashboard/export"
            className="rounded-pill bg-muted flex h-12 items-center justify-center px-4 text-sm font-semibold text-ink sm:hidden"
          >
            Export Excel
          </a>
          <FadeIn delay={0}>
            <ShiftHistorySection shifts={shifts} />
          </FadeIn>
          <FadeIn delay={0.05}>
            <OmzetSection history={omzetHistory} />
          </FadeIn>
          <FadeIn delay={0.1}>
            <TopItemsSection products={topProducts} toppings={topToppings} />
          </FadeIn>
          <FadeIn delay={0.15}>
            <MarginSection report={marginReport} lowMarginItems={lowMarginItems} />
          </FadeIn>
          <FadeIn delay={0.2}>
            <ChannelBreakdownSection rows={channelBreakdown} />
          </FadeIn>
          <FadeIn delay={0.25}>
            <PiutangSection orders={receivables} />
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
