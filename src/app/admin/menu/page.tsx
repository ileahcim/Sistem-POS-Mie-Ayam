import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMenuAdminData } from "@/lib/menu/get-menu-admin-data";
import { getBaksoUsageSetting } from "@/lib/settings/get-bakso-usage-setting";
import { getMieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { getMiePasarPrice } from "@/lib/mie/get-mie-pasar-price";
import { getFrozenPrice } from "@/lib/frozen/get-frozen-price";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { MenuAdminScreen } from "@/components/admin/menu-admin-screen";

// OWNER only, checked server-side here — see CLAUDE.md "Server-side
// authorization". Every action in actions.ts also requireRole("OWNER")
// itself, since those are independent entry points this redirect doesn't
// protect.
export default async function MenuAdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [{ categories, addonGroups }, baksoUsage, defaults, pasarPricePerKg, frozenPricePerPcs, nav] = await Promise.all([
    getMenuAdminData(),
    getBaksoUsageSetting(),
    getMieProductDefaults(),
    getMiePasarPrice(),
    getFrozenPrice(),
    getHeaderNav(),
  ]);
  return (
    <MenuAdminScreen
      categories={categories}
      addonGroups={addonGroups}
      baksoUsage={baksoUsage}
      mieDefaults={defaults}
      miePasarPricePerKg={pasarPricePerKg}
      frozenPricePerPcs={frozenPricePerPcs}
      nav={nav}
    />
  );
}
