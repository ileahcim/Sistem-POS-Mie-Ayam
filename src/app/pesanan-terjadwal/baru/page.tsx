import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getComboShortcuts } from "@/lib/combo/get-combo-shortcuts";
import { PreOrderScreen } from "@/components/pesanan-terjadwal/preorder-screen";

// No shift gate here on purpose — see CLAUDE.md "Pre-order".
export default async function PreOrderBaruPage() {
  const [categories, comboShortcuts] = await Promise.all([getActiveMenu(), getComboShortcuts()]);
  return <PreOrderScreen categories={categories} comboShortcuts={comboShortcuts} />;
}
