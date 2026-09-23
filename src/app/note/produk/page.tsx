import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { getMiePasarPrice } from "@/lib/mie/get-mie-pasar-price";
import { getFrozenPrice } from "@/lib/frozen/get-frozen-price";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { ProductDefaultsScreen } from "@/components/note/product-defaults-screen";

export default async function MieProductDefaultsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [defaults, pasarPricePerKg, frozenPricePerPcs, nav] = await Promise.all([
    getMieProductDefaults(),
    getMiePasarPrice(),
    getFrozenPrice(),
    getHeaderNav(),
  ]);
  return (
    <ProductDefaultsScreen
      defaults={defaults}
      pasarPricePerKg={pasarPricePerKg}
      frozenPricePerPcs={frozenPricePerPcs}
      nav={nav}
    />
  );
}
