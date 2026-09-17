import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieCustomers } from "@/lib/mie/get-mie-customers";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { NewPaymentForm } from "@/components/note/new-payment-form";

export default async function NewMiePaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId } = await searchParams;
  const [customers, orderAktifIndicator] = await Promise.all([getMieCustomers(), getOrderAktifIndicator()]);
  return (
    <NewPaymentForm customers={customers} initialCustomerId={customerId} orderAktifIndicator={orderAktifIndicator} />
  );
}
