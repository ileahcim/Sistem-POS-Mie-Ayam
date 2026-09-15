import { redirect } from "next/navigation";
import { getOpenShift, getShiftExpenses } from "@/lib/shift/get-shift-state";
import { PengeluaranForm } from "@/components/shift/pengeluaran-form";

export default async function PengeluaranPage() {
  const shift = await getOpenShift();
  if (!shift) redirect("/shift/buka");

  const expenses = await getShiftExpenses(shift.id);
  return <PengeluaranForm initialExpenses={expenses} />;
}
