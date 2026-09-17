import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { ProductDefaultsScreen } from "@/components/note/product-defaults-screen";

export default async function MieProductDefaultsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [defaults, orderAktifIndicator] = await Promise.all([getMieProductDefaults(), getOrderAktifIndicator()]);
  return <ProductDefaultsScreen defaults={defaults} orderAktifIndicator={orderAktifIndicator} />;
}
