import { redirect } from "next/navigation";
import { getOpenShift } from "@/lib/shift/get-shift-state";
import { BukaShiftForm } from "@/components/shift/buka-shift-form";

export default async function BukaShiftPage() {
  const openShift = await getOpenShift();
  if (openShift) redirect("/kasir");

  return <BukaShiftForm />;
}
