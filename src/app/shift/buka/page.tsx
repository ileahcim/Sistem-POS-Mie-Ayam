import { redirect } from "next/navigation";
import { getOpenShift } from "@/lib/shift/get-shift-state";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { BukaShiftForm } from "@/components/shift/buka-shift-form";

export default async function BukaShiftPage() {
  const [openShift, user] = await Promise.all([getOpenShift(), getCurrentUser()]);
  if (openShift) redirect("/kasir");

  return <BukaShiftForm isOwner={user?.role === "OWNER"} />;
}
