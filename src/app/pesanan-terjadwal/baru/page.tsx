import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getComboShortcuts } from "@/lib/combo/get-combo-shortcuts";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { PreOrderScreen } from "@/components/pesanan-terjadwal/preorder-screen";

// No shift gate here on purpose — see CLAUDE.md "Pre-order". DP is not taken
// on this screen any more; it's "+ Catat DP" on the saved pre-order.
export default async function PreOrderBaruPage() {
  const [categories, comboShortcuts, nav] = await Promise.all([getActiveMenu(), getComboShortcuts(), getHeaderNav()]);
  return <PreOrderScreen categories={categories} comboShortcuts={comboShortcuts} nav={nav} />;
}
