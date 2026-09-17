import { prisma } from "@/lib/prisma";
import { mieEntrySignedAmount } from "./types";

export type MieCustomerRow = {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  balance: number; // sum over every ledger entry — never a stored column, see schema.prisma
};

// Sorted biggest-debt-first by default — that's the whole point of this
// list per the brief ("Urut dari utang terbesar"); the /note list can also
// re-sort by name client-side. A customer who's paid ahead (negative
// balance) still shows, just sinks toward the bottom.
//
// Active customers only unless asked: a nonaktif customer can't be picked
// for a new transaction (the forms use the default), but the /note page
// still lists them separately so their history stays reachable.
export async function getMieCustomers({ includeInactive = false } = {}): Promise<MieCustomerRow[]> {
  const customers = await prisma.mieCustomer.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: { entries: { select: { kind: true, amount: true } } },
  });

  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    note: c.note,
    isActive: c.isActive,
    balance: c.entries.reduce((sum, e) => sum + mieEntrySignedAmount(e), 0),
  }));

  return rows.sort((a, b) => b.balance - a.balance);
}
