import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getFrozenCustomers } from "@/lib/frozen/get-frozen-customers";
import { getFrozenSummary } from "@/lib/frozen/get-frozen-summary";
import { getFrozenTodayActivity } from "@/lib/frozen/get-frozen-today-activity";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { FrozenScreen } from "@/components/note/frozen-screen";

// OWNER only, checked server-side here — see CLAUDE.md "Server-side
// authorization". Every action in note/frozen-actions.ts also
// requireRole("OWNER") itself.
export default async function FrozenPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [customers, todayActivity, summary, nav] = await Promise.all([
    getFrozenCustomers({ includeInactive: true }),
    getFrozenTodayActivity(),
    getFrozenSummary(),
    getHeaderNav(),
  ]);
  return <FrozenScreen customers={customers} todayActivity={todayActivity} summary={summary} nav={nav} />;
}
