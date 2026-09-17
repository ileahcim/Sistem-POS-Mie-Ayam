import { redirect } from "next/navigation";
import { getOpenShift, getUnpaidOrdersForShift, getShiftExpenses } from "@/lib/shift/get-shift-state";
import { TutupShiftFlow } from "@/components/shift/tutup-shift-flow";

export default async function TutupShiftPage() {
  const shift = await getOpenShift();
  if (!shift) redirect("/shift/buka");

  const [unpaidOrders, expenses] = await Promise.all([
    getUnpaidOrdersForShift(shift.id),
    getShiftExpenses(shift.id),
  ]);

  return (
    <TutupShiftFlow initialUnpaidOrders={unpaidOrders} initialExpenses={expenses} />
  );
}
