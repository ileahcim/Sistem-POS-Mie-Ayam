import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getShiftHistory } from "@/lib/dashboard/get-shift-history";
import { getOmzetHistory } from "@/lib/dashboard/get-omzet-history";
import { getDashboardOrders, getDashboardOrderTimings } from "@/lib/dashboard/get-sales-data";
import { getReceivableOrders } from "@/lib/orders/get-receivable-orders";
import { getBaksoUsageSetting } from "@/lib/settings/get-bakso-usage-setting";
import { getHeaderNav } from "@/lib/header/get-header-nav";
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

  const [shifts, omzetHistory, sales, timings, baksoUsageSetting, receivables, nav] = await Promise.all([
    getShiftHistory(),
    getOmzetHistory(),
    getDashboardOrders(),
    getDashboardOrderTimings(),
    getBaksoUsageSetting(),
    getReceivableOrders(),
    getHeaderNav(),
  ]);

  return (
    <DashboardScreen
      shifts={shifts}
      omzetHistory={omzetHistory}
      salesOrders={sales.orders}
      timings={timings}
      baksoUsageSetting={baksoUsageSetting}
      today={sales.today}
      receivables={receivables}
      nav={nav}
    />
  );
}
