import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getComboShortcuts } from "@/lib/combo/get-combo-shortcuts";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { PreOrderScreen } from "@/components/pesanan-terjadwal/preorder-screen";

// No shift gate here on purpose — see CLAUDE.md "Pre-order".
export default async function PreOrderBaruPage() {
  const [categories, comboShortcuts, orderAktifIndicator] = await Promise.all([
    getActiveMenu(),
    getComboShortcuts(),
    getOrderAktifIndicator(),
  ]);
  return (
    <PreOrderScreen categories={categories} comboShortcuts={comboShortcuts} orderAktifIndicator={orderAktifIndicator} />
  );
}
