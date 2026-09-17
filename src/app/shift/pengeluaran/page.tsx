import { redirect } from "next/navigation";
import { getOpenShift, getShiftExpenses } from "@/lib/shift/get-shift-state";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { PengeluaranForm } from "@/components/shift/pengeluaran-form";

export default async function PengeluaranPage() {
  const shift = await getOpenShift();
  if (!shift) redirect("/shift/buka");

  const [expenses, nav] = await Promise.all([getShiftExpenses(shift.id), getHeaderNav()]);
  return <PengeluaranForm initialExpenses={expenses} nav={nav} />;
}
