import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getShiftHistory } from "@/lib/dashboard/get-shift-history";
import { getOmzetHistory } from "@/lib/dashboard/get-omzet-history";
import { getTopProducts, getTopToppings } from "@/lib/dashboard/get-top-items";
import { getMarginReport } from "@/lib/dashboard/get-margin-report";
import { getLowMarginItems } from "@/lib/dashboard/get-low-margin-items";
import { getChannelBreakdown } from "@/lib/dashboard/get-channel-breakdown";
import { getReceivableOrders } from "@/lib/orders/get-receivable-orders";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

// OWNER only, checked server-side here (not just a hidden menu item) — see
// CLAUDE.md "Server-side authorization". This page has no client-invokable
// "use server" actions of its own (all data fetching happens in this RSC,
// the only entry point to see it), so this redirect is the complete gate
// for reading dashboard data; the separate Excel export route has its own
// requireRole("OWNER") since it's a second, independent entry point.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [
    shifts,
    omzetHistory,
    topProducts,
    topToppings,
    marginReport,
    lowMarginItems,
    channelBreakdown,
    receivables,
    orderAktifIndicator,
  ] = await Promise.all([
    getShiftHistory(),
    getOmzetHistory(),
    getTopProducts(),
    getTopToppings(),
    getMarginReport(),
    getLowMarginItems(),
    getChannelBreakdown(),
    getReceivableOrders(),
    getOrderAktifIndicator(),
  ]);

  return (
    <DashboardScreen
      shifts={shifts}
      omzetHistory={omzetHistory}
      topProducts={topProducts}
      topToppings={topToppings}
      marginReport={marginReport}
      lowMarginItems={lowMarginItems}
      channelBreakdown={channelBreakdown}
      receivables={receivables}
      orderAktifIndicator={orderAktifIndicator}
    />
  );
}
