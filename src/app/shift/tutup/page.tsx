import { redirect } from "next/navigation";
import { getOpenShift, getUnpaidOrdersForShift, getShiftExpenses } from "@/lib/shift/get-shift-state";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { TutupShiftFlow } from "@/components/shift/tutup-shift-flow";

export default async function TutupShiftPage() {
  const shift = await getOpenShift();
  if (!shift) redirect("/shift/buka");

  const [unpaidOrders, expenses, nav] = await Promise.all([
    getUnpaidOrdersForShift(shift.id),
    getShiftExpenses(shift.id),
    getHeaderNav(),
  ]);

  return (
    <TutupShiftFlow initialUnpaidOrders={unpaidOrders} initialExpenses={expenses} nav={nav} />
  );
}
