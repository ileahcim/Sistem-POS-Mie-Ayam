import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getSettings } from "@/lib/settings/get-settings";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { SettingsScreen } from "@/components/admin/settings-screen";

// OWNER only, checked server-side here — see CLAUDE.md "Server-side
// authorization". updateAutoPrintReceipt (actions.ts) also
// requireRole("OWNER") itself, since it's a second, independent entry point
// this redirect doesn't protect.
export default async function SettingsAdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [settings, nav] = await Promise.all([getSettings(), getHeaderNav()]);
  return <SettingsScreen settings={settings} nav={nav} />;
}
