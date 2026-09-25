import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { getMiePasarPrice } from "@/lib/mie/get-mie-pasar-price";
import { getFrozenPrice } from "@/lib/frozen/get-frozen-price";
import { getMieCosts } from "@/lib/mie/get-mie-costs";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { ProductDefaultsScreen } from "@/components/note/product-defaults-screen";

// Shared by both books; Kembali returns to whichever screen linked here.
const BACK_HREF: Record<string, string> = { frozen: "/note/frozen/utang", ringkasan: "/note/ringkasan" };

export default async function MieProductDefaultsPage({ searchParams }: { searchParams: Promise<{ dari?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { dari } = await searchParams;

  const [defaults, pasarPricePerKg, frozenPricePerPcs, costs, nav] = await Promise.all([
    getMieProductDefaults(),
    getMiePasarPrice(),
    getFrozenPrice(),
    getMieCosts(),
    getHeaderNav(),
  ]);
  return (
    <ProductDefaultsScreen
      defaults={defaults}
      pasarPricePerKg={pasarPricePerKg}
      frozenPricePerPcs={frozenPricePerPcs}
      costs={costs}
      backHref={BACK_HREF[dari ?? ""] ?? "/note/utang"}
      nav={nav}
    />
  );
}
