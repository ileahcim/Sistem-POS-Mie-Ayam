import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { NewFrozenCustomerForm } from "@/components/note/new-frozen-customer-form";

export default async function NewFrozenCustomerPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const nav = await getHeaderNav();
  return <NewFrozenCustomerForm nav={nav} />;
}
