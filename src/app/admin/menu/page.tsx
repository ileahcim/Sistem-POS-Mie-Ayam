import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMenuAdminData } from "@/lib/menu/get-menu-admin-data";
import { getBaksoUsageSetting } from "@/lib/settings/get-bakso-usage-setting";
import { getMieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { getMiePasarPrice } from "@/lib/mie/get-mie-pasar-price";
import { getMieSpecialPrices } from "@/lib/mie/get-mie-customer-prices";
import { getMieCustomers } from "@/lib/mie/get-mie-customers";
import { getFrozenPrice } from "@/lib/frozen/get-frozen-price";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { adminBackHref } from "@/lib/note/settings-links";
import { MenuAdminScreen } from "@/components/admin/menu-admin-screen";

// OWNER only, checked server-side here — see CLAUDE.md "Server-side
// authorization". Every action in actions.ts also requireRole("OWNER")
// itself, since those are independent entry points this redirect doesn't
// protect. The Mi Mentah section's actions are Note's own (note/actions.ts,
// note/frozen-actions.ts), each also requireRole("OWNER").
export default async function MenuAdminPage({ searchParams }: { searchParams: Promise<{ dari?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { dari } = await searchParams;
  const [{ categories, addonGroups }, baksoUsage, defaults, pasarPricePerKg, frozenPricePerPcs, specialPrices, customers, nav] =
    await Promise.all([
      getMenuAdminData(),
      getBaksoUsageSetting(),
      getMieProductDefaults(),
      getMiePasarPrice(),
      getFrozenPrice(),
      getMieSpecialPrices(),
      getMieCustomers(),
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
      specialPrices={specialPrices}
      mieCustomers={customers
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }))}
      backHref={adminBackHref(dari)}
      nav={nav}
    />
  );
}
