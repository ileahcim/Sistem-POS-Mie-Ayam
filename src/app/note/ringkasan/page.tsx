import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieReportPoints } from "@/lib/mie/get-mie-report";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { MieReportScreen } from "@/components/note/mie-report-screen";

// OWNER only, same as the rest of /note — and, like /note, no shift gate.
export default async function MieReportPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [{ points, today }, orderAktifIndicator] = await Promise.all([
    getMieReportPoints(),
    getOrderAktifIndicator(),
  ]);
  return <MieReportScreen points={points} today={today} orderAktifIndicator={orderAktifIndicator} />;
}
