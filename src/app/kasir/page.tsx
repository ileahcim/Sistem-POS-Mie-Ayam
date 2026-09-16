import { redirect } from "next/navigation";
import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getOpenShift } from "@/lib/shift/get-shift-state";
import { getComboShortcuts } from "@/lib/combo/get-combo-shortcuts";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { KasirScreen } from "@/components/kasir/kasir-screen";

export default async function KasirPage() {
  const openShift = await getOpenShift();
  if (!openShift) redirect("/shift/buka");

  const [categories, comboShortcuts, user] = await Promise.all([
    getActiveMenu(),
    getComboShortcuts(),
    getCurrentUser(),
  ]);
  return (
    <KasirScreen categories={categories} comboShortcuts={comboShortcuts} isOwner={user?.role === "OWNER"} />
  );
}
