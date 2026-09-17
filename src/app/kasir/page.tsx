import { redirect } from "next/navigation";
import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getOpenShift } from "@/lib/shift/get-shift-state";
import { getComboShortcuts } from "@/lib/combo/get-combo-shortcuts";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { KasirScreen } from "@/components/kasir/kasir-screen";

export default async function KasirPage() {
  const openShift = await getOpenShift();
  if (!openShift) redirect("/shift/buka");

  const [categories, comboShortcuts, nav] = await Promise.all([
    getActiveMenu(),
    getComboShortcuts(),
    getHeaderNav(),
  ]);
  return (
    <KasirScreen
      categories={categories}
      comboShortcuts={comboShortcuts}
      nav={nav}
    />
  );
}
