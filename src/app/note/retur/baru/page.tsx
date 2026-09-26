import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieCustomers } from "@/lib/mie/get-mie-customers";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { getMieDefaultJenis } from "@/lib/mie/get-mie-default-jenis";
import { NewReturnForm } from "@/components/note/new-return-form";
import { parseNoteOrigin } from "@/lib/note/books";

export default async function NewMieReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; dari?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId, dari } = await searchParams;
  const [customers, defaultJenis, nav] = await Promise.all([getMieCustomers(), getMieDefaultJenis(), getHeaderNav()]);
  return (
    <NewReturnForm
      customers={customers}
      initialCustomerId={customerId}
      origin={parseNoteOrigin(dari)}
      defaultJenis={defaultJenis}
      nav={nav}
    />
  );
}
