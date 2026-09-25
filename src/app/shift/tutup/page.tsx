import { redirect } from "next/navigation";
import { getOpenShift, getUnpaidOrdersForShift, getReceivablesForShift, getShiftExpenses } from "@/lib/shift/get-shift-state";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { TutupShiftFlow } from "@/components/shift/tutup-shift-flow";

export default async function TutupShiftPage() {
  const shift = await getOpenShift();
  if (!shift) redirect("/shift/buka");

  const [unpaidOrders, receivables, expenses, nav] = await Promise.all([
    getUnpaidOrdersForShift(shift.id),
    getReceivablesForShift(shift.id),
    getShiftExpenses(shift.id),
    getHeaderNav(),
  ]);

  return (
    <TutupShiftFlow
      initialUnpaidOrders={unpaidOrders}
      initialReceivables={receivables}
      initialExpenses={expenses}
      nav={nav}
    />
  );
}
