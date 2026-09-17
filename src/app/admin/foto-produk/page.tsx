import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { ProductPhotosScreen } from "@/components/admin/product-photos-screen";

// OWNER only, checked here — and again inside each action (actions.ts),
// since those are separate entry points this redirect doesn't protect.
export default async function ProductPhotosPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [categories, nav] = await Promise.all([getActiveMenu(), getHeaderNav()]);
  return (
    <ProductPhotosScreen
      nav={nav}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        products: c.products.map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl })),
      }))}
    />
  );
}
