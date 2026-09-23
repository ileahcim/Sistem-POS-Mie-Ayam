import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getFrozenReportPoints } from "@/lib/frozen/get-frozen-report";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { FrozenReportScreen } from "@/components/note/frozen-report-screen";

// OWNER only, same as the rest of /note/frozen — and, like Mi Mentah's
// Ringkasan, no shift gate.
export default async function FrozenReportPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [{ points, today }, nav] = await Promise.all([getFrozenReportPoints(), getHeaderNav()]);
  return <FrozenReportScreen points={points} today={today} nav={nav} />;
}
