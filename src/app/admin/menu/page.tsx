import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMenuAdminData } from "@/lib/menu/get-menu-admin-data";
import { getBaksoUsageSetting } from "@/lib/settings/get-bakso-usage-setting";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { MenuAdminScreen } from "@/components/admin/menu-admin-screen";

// OWNER only, checked server-side here — see CLAUDE.md "Server-side
// authorization". Every action in actions.ts also requireRole("OWNER")
// itself, since those are independent entry points this redirect doesn't
// protect.
export default async function MenuAdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [{ categories, addonGroups }, baksoUsage, nav] = await Promise.all([
    getMenuAdminData(),
    getBaksoUsageSetting(),
    getHeaderNav(),
  ]);
  return <MenuAdminScreen categories={categories} addonGroups={addonGroups} baksoUsage={baksoUsage} nav={nav} />;
}
