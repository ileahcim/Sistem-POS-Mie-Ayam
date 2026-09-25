import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieReportPoints } from "@/lib/mie/get-mie-report";
import { getMieCosts } from "@/lib/mie/get-mie-costs";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { MieReportScreen } from "@/components/note/mie-report-screen";

// OWNER only, same as the rest of /note — and, like /note, no shift gate.
export default async function MieReportPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [{ points, today }, costs, nav] = await Promise.all([
    getMieReportPoints(),
    getMieCosts(),
    getHeaderNav(),
  ]);
  return <MieReportScreen points={points} today={today} costs={costs} nav={nav} />;
}
