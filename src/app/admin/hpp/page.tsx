import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getHppItems } from "@/lib/hpp/get-hpp-items";
import { getMieCosts } from "@/lib/mie/get-mie-costs";
import { getMieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { getMiePasarPrice } from "@/lib/mie/get-mie-pasar-price";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { HppScreen } from "@/components/admin/hpp-screen";

// OWNER only, checked server-side here — see CLAUDE.md "Server-side
// authorization". updateHppItem (actions.ts) also requireRole("OWNER")
// itself, since it's a second, independent entry point this redirect
// doesn't protect.
export default async function HppAdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [{ products, addons }, mieCosts, mieDefaults, miePasarPricePerKg, nav] = await Promise.all([
    getHppItems(),
    getMieCosts(),
    getMieProductDefaults(),
    getMiePasarPrice(),
    getHeaderNav(),
  ]);
  return (
    <HppScreen
      products={products}
      addons={addons}
      mieCosts={mieCosts}
      mieDefaults={mieDefaults}
      miePasarPricePerKg={miePasarPricePerKg}
      nav={nav}
    />
  );
}
