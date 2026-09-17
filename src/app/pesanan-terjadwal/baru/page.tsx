import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getComboShortcuts } from "@/lib/combo/get-combo-shortcuts";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { PreOrderScreen } from "@/components/pesanan-terjadwal/preorder-screen";

// No shift gate here on purpose — see CLAUDE.md "Pre-order".
export default async function PreOrderBaruPage() {
  const [categories, comboShortcuts, nav] = await Promise.all([
    getActiveMenu(),
    getComboShortcuts(),
    getHeaderNav(),
  ]);
  return (
    <PreOrderScreen categories={categories} comboShortcuts={comboShortcuts} nav={nav} />
  );
}
