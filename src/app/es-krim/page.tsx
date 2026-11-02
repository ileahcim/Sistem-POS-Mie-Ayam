import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getIceCreamProducts } from "@/lib/stock/get-ice-cream";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { IceCreamScreen } from "@/components/es-krim/ice-cream-screen";

// Stok Es Krim — every role (Ambil Sendiri is for OWNER & CASHIER). The
// owner-only parts are hidden for a cashier here (UX), and each owner
// action in actions.ts checks requireRole("OWNER") itself (the real guard).
export default async function EsKrimPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [products, nav] = await Promise.all([getIceCreamProducts(), getHeaderNav()]);
  return <IceCreamScreen products={products} isOwner={user.role === "OWNER"} nav={nav} />;
}
