import { redirect } from "next/navigation";
import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getOpenShift } from "@/lib/shift/get-shift-state";
import { getComboShortcuts } from "@/lib/combo/get-combo-shortcuts";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getPreOrderReminders } from "@/lib/orders/get-preorders";
import { getSettings } from "@/lib/settings/get-settings";
import { KasirScreen } from "@/components/kasir/kasir-screen";

export default async function KasirPage() {
  const [openShift, user] = await Promise.all([getOpenShift(), getCurrentUser()]);
  // OWNER may look at Kasir before the shift is open (checking the menu,
  // prices, an order from last night) — the screen then shows a red banner
  // and refuses to save. A CASHIER still lands straight on Buka Shift,
  // since for them there is nothing to do here before the shift exists.
  // Either way saveOrder() rejects a missing shift server-side; this is
  // only about which screen you get to look at.
  if (!openShift && user?.role !== "OWNER") redirect("/shift/buka");

  const [categories, comboShortcuts, nav, settings] = await Promise.all([
    getActiveMenu(),
    getComboShortcuts(),
    getHeaderNav(),
    getSettings(),
  ]);
  // Re-read on every request — the root layout forces dynamic rendering, so
  // a pre-order entering the window shows up on the next screen refresh
  // without any client-side clock (see CLAUDE.md "Rendering dinamis").
  const preorderReminders = await getPreOrderReminders(settings.preorderReminderMinutes);

  return (
    <KasirScreen
      categories={categories}
      comboShortcuts={comboShortcuts}
      nav={nav}
      shiftOpen={!!openShift}
      preorderReminders={preorderReminders}
      printerDriver={settings.printerDriver}
      kitchenTicketEnabled={settings.kitchenTicketEnabled}
    />
  );
}
