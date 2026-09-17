import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieCustomers } from "@/lib/mie/get-mie-customers";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { NewOrderForm } from "@/components/note/new-order-form";

export default async function NewMieOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId } = await searchParams;
  const [customers, orderAktifIndicator] = await Promise.all([getMieCustomers(), getOrderAktifIndicator()]);
  return <NewOrderForm customers={customers} initialCustomerId={customerId} orderAktifIndicator={orderAktifIndicator} />;
}
