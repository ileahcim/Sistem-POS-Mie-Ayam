// Note's Hari Ini tab (/note and /note/frozen): every pesanan/pengambilan
// and pembayaran RECORDED today (createdAt, WIB), regardless of the
// customer's balance now — so a customer who ordered and paid in full the
// same day, and so sank out of "Utang terbesar", is still one glance away.
// Same shape for both books; each book has its own loader
// (get-mie-today-activity.ts / get-frozen-today-activity.ts).
//
// Since 26 Sep 2026 the tab shows ONE ROW PER CUSTOMER (a customer who
// ordered then paid used to appear twice, which read as a duplicate); each
// row expands to that customer's transactions of today. Grouping and status
// are decided here, once, as pure functions.

export type TodayActivityRow<E = unknown> = {
  id: string;
  customerId: string;
  customerName: string;
  // Inactive customers can't take a new transaction — no Bayar shortcut.
  customerActive: boolean;
  kind: "ORDER" | "PAYMENT" | "RETURN";
  kindLabel: string; // "Pesanan" / "Pengambilan" / "Pembayaran" / "Retur"
  detail: string | null; // e.g. "Mi Keriting · 10 kg", "7 pcs", "Cash"
  qty: number | null; // ORDER/RETURN rows: kg (Mi Mentah) or pcs (Frozen)
  amount: number;
  time: string; // "HH.MM" Jakarta, when it was recorded
  createdAt: string; // ISO, for ordering
  // The full ledger row, handed as-is to the book's own EntrySheet /
  // FrozenEntrySheet — the same edit/delete path as the customer page.
  entry: E;
};

export type TodayActivity<E = unknown> = {
  rows: TodayActivityRow<E>[];
  // customerId → balance NOW (every ledger row the customer has, not only
  // today's), for each customer that appears in `rows`.
  balances: Record<string, number>;
};

// From the customer's TOTAL balance, not just today's transactions:
//   LUNAS        balance ≤ 0 (paid up, or paid ahead)
//   KURANG       paid something today, still owes
//   BELUM_BAYAR  owes, and no payment today
export type TodayCustomerStatus = "LUNAS" | "KURANG" | "BELUM_BAYAR";

export type TodayCustomerGroup<E = unknown> = {
  customerId: string;
  customerName: string;
  customerActive: boolean;
  balance: number;
  status: TodayCustomerStatus;
  rows: TodayActivityRow<E>[]; // oldest first — reads as the day's story
  orderCount: number;
  orderAmount: number;
  orderQty: number;
  paymentCount: number;
  paymentAmount: number;
  // Retur (26 Sep 2026): mi given back today — lowers what today's orders
  // come to before today's payments are split (see splitTodayPayment).
  returnCount: number;
  returnAmount: number;
  returnQty: number;
  latestAt: string; // ISO of the newest row
} & TodayPaymentSplit;

// How today's payments READ on the Hari Ini row (26 Sep 2026, owner's rule):
// money paid today covers today's orders first, the rest pays down the old
// debt, anything beyond that is overpayment. DISPLAY ONLY — the ledger still
// holds one PAYMENT row, never matched to an order ("Pembayaran tidak
// dicocokkan ke pesanan tertentu"), and the balance is the same number
// whichever way it is read. A credit the customer already had (paid ahead
// before today) covers today's orders before today's money does. Today's
// retur comes off today's orders first; a retur bigger than them (mi from an
// earlier order) comes off the old debt. Without a retur this is exactly the
// split it was before retur existed.
export type TodayPaymentSplit = {
  payForToday: number; // today's payments that went to today's orders
  payForOld: number; // today's payments that paid down debt from before today
  payExcess: number; // today's payments beyond everything owed (lebih bayar)
  todayShort: number; // what is still unpaid of today's orders
  oldRemaining: number; // debt from before today still unpaid after today (≥ 0)
};

export function splitTodayPayment(
  orderAmount: number,
  paymentAmount: number,
  balance: number,
  returnAmount = 0,
): TodayPaymentSplit {
  const net = orderAmount - returnAmount; // today's orders after today's retur
  const before = balance - net + paymentAmount; // balance at the start of today
  const credit = Math.max(-before, 0);
  const oldDebt = Math.max(Math.max(before, 0) + Math.min(net, 0), 0); // a retur beyond today's orders pays old debt
  const today = Math.max(net, 0);
  const payForToday = Math.min(paymentAmount, Math.max(today - credit, 0));
  const payForOld = Math.min(paymentAmount - payForToday, oldDebt);
  return {
    payForToday,
    payForOld,
    payExcess: paymentAmount - payForToday - payForOld,
    todayShort: today - Math.min(today, credit) - payForToday,
    oldRemaining: oldDebt - payForOld,
  };
}

export function todayCustomerStatus(balance: number, paymentCount: number): TodayCustomerStatus {
  if (balance <= 0) return "LUNAS";
  return paymentCount > 0 ? "KURANG" : "BELUM_BAYAR";
}

// Not-yet-paid-up customers on top, most recent activity first; paid-up
// customers below them, also most recent first.
export function groupTodayActivity<E>(activity: TodayActivity<E>): TodayCustomerGroup<E>[] {
  const byCustomer = new Map<string, TodayActivityRow<E>[]>();
  for (const r of activity.rows) {
    const list = byCustomer.get(r.customerId);
    if (list) list.push(r);
    else byCustomer.set(r.customerId, [r]);
  }

  const groups: TodayCustomerGroup<E>[] = [];
  for (const [customerId, list] of byCustomer) {
    const rows = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const orders = rows.filter((r) => r.kind === "ORDER");
    const payments = rows.filter((r) => r.kind === "PAYMENT");
    const returns = rows.filter((r) => r.kind === "RETURN");
    const returnAmount = returns.reduce((s, r) => s + r.amount, 0);
    const balance = activity.balances[customerId] ?? 0;
    const orderAmount = orders.reduce((s, r) => s + r.amount, 0);
    const paymentAmount = payments.reduce((s, r) => s + r.amount, 0);
    groups.push({
      customerId,
      customerName: rows[0].customerName,
      customerActive: rows[0].customerActive,
      balance,
      status: todayCustomerStatus(balance, payments.length),
      rows,
      orderCount: orders.length,
      orderAmount,
      orderQty: orders.reduce((s, r) => s + (r.qty ?? 0), 0),
      paymentCount: payments.length,
      paymentAmount,
      returnCount: returns.length,
      returnAmount,
      returnQty: returns.reduce((s, r) => s + (r.qty ?? 0), 0),
      latestAt: rows[rows.length - 1].createdAt,
      ...splitTodayPayment(orderAmount, paymentAmount, balance, returnAmount),
    });
  }

  return groups.sort((a, b) => {
    const aPaid = a.status === "LUNAS" ? 1 : 0;
    const bPaid = b.status === "LUNAS" ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid;
    return b.latestAt.localeCompare(a.latestAt);
  });
}
