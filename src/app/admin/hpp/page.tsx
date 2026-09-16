import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getHppItems } from "@/lib/hpp/get-hpp-items";
import { HppScreen } from "@/components/admin/hpp-screen";

// OWNER only, checked server-side here — see CLAUDE.md "Server-side
// authorization". updateHppItem (actions.ts) also requireRole("OWNER")
// itself, since it's a second, independent entry point this redirect
// doesn't protect.
export default async function HppAdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { products, addons } = await getHppItems();
  return <HppScreen products={products} addons={addons} />;
}
