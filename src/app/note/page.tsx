import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieCustomers } from "@/lib/mie/get-mie-customers";
import { getMieSummary } from "@/lib/mie/get-mie-summary";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { NoteScreen } from "@/components/note/note-screen";

// OWNER only, checked server-side here — see CLAUDE.md "Server-side
// authorization". Every action in note/actions.ts also requireRole("OWNER")
// itself, since those are independent entry points this redirect doesn't
// protect.
export default async function NotePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [customers, summary, orderAktifIndicator] = await Promise.all([
    getMieCustomers({ includeInactive: true }),
    getMieSummary(),
    getOrderAktifIndicator(),
  ]);
  return <NoteScreen customers={customers} summary={summary} orderAktifIndicator={orderAktifIndicator} />;
}
