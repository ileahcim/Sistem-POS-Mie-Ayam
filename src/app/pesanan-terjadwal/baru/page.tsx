import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getComboShortcuts } from "@/lib/combo/get-combo-shortcuts";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { getOpenShift } from "@/lib/shift/get-shift-state";
import { getSettings } from "@/lib/settings/get-settings";
import { PreOrderScreen } from "@/components/pesanan-terjadwal/preorder-screen";

// No shift gate here on purpose — see CLAUDE.md "Pre-order". The open shift is
// only read to know whether a CASH DP can be offered (it goes into the drawer).
export default async function PreOrderBaruPage() {
  const [categories, comboShortcuts, nav, openShift, settings] = await Promise.all([
    getActiveMenu(),
    getComboShortcuts(),
    getHeaderNav(),
    getOpenShift(),
    getSettings(),
  ]);
  return (
    <PreOrderScreen
      categories={categories}
      comboShortcuts={comboShortcuts}
      nav={nav}
      cashDepositAvailable={!!openShift}
      autoPrintReceipt={settings.autoPrintReceipt}
      printerDriver={settings.printerDriver}
    />
  );
}
