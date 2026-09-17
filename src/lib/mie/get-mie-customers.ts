import { prisma } from "@/lib/prisma";
import { mieEntrySignedAmount } from "./types";

export type MieCustomerRow = {
  id: string;
  name: string;
  note: string | null;
  balance: number; // sum over every ledger entry — never a stored column, see schema.prisma
};

// Sorted biggest-debt-first — that's the whole point of this list per the
// brief ("Urut dari utang terbesar"). A customer who's paid ahead (negative
// balance) still shows, just sinks toward the bottom.
export async function getMieCustomers(): Promise<MieCustomerRow[]> {
  const customers = await prisma.mieCustomer.findMany({
    where: { isActive: true },
    include: { entries: { select: { kind: true, amount: true } } },
  });

  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    note: c.note,
    balance: c.entries.reduce((sum, e) => sum + mieEntrySignedAmount(e), 0),
  }));

  return rows.sort((a, b) => b.balance - a.balance);
}
