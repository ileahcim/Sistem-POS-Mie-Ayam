import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieCustomers } from "@/lib/mie/get-mie-customers";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { NewPaymentForm } from "@/components/note/new-payment-form";

export default async function NewMiePaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId } = await searchParams;
  const [customers, nav] = await Promise.all([getMieCustomers(), getHeaderNav()]);
  return (
    <NewPaymentForm customers={customers} initialCustomerId={customerId} nav={nav} />
  );
}
