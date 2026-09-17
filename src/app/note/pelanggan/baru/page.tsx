import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { NewCustomerForm } from "@/components/note/new-customer-form";

export default async function NewMieCustomerPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const orderAktifIndicator = await getOrderAktifIndicator();
  return <NewCustomerForm orderAktifIndicator={orderAktifIndicator} />;
}
