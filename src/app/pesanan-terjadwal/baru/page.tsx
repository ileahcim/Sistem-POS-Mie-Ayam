import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { PreOrderScreen } from "@/components/pesanan-terjadwal/preorder-screen";

// No shift gate here on purpose — see CLAUDE.md "Pre-order".
export default async function PreOrderBaruPage() {
  const categories = await getActiveMenu();
  return <PreOrderScreen categories={categories} />;
}
