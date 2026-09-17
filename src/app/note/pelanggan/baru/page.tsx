import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { NewCustomerForm } from "@/components/note/new-customer-form";

export default async function NewMieCustomerPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const nav = await getHeaderNav();
  return <NewCustomerForm nav={nav} />;
}
