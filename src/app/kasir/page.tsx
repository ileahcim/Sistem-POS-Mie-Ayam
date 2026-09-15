import { redirect } from "next/navigation";
import { getActiveMenu } from "@/lib/menu/get-active-menu";
import { getOpenShift } from "@/lib/shift/get-shift-state";
import { KasirScreen } from "@/components/kasir/kasir-screen";

export default async function KasirPage() {
  const openShift = await getOpenShift();
  if (!openShift) redirect("/shift/buka");

  const categories = await getActiveMenu();
  return <KasirScreen categories={categories} />;
}
