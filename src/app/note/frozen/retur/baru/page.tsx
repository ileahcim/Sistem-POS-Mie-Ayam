import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getFrozenCustomers } from "@/lib/frozen/get-frozen-customers";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { NewFrozenReturnForm } from "@/components/note/new-frozen-return-form";
import { parseNoteOrigin } from "@/lib/note/books";

export default async function NewFrozenReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; dari?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const { customerId, dari } = await searchParams;
  const [customers, nav] = await Promise.all([getFrozenCustomers(), getHeaderNav()]);
  return (
    <NewFrozenReturnForm customers={customers} initialCustomerId={customerId} origin={parseNoteOrigin(dari)} nav={nav} />
  );
}
