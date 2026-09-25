// The numbers a shift freezes at close — one pure function, so the rule that
// keeps the drawer honest lives in exactly one place and can be tested
// against the pre-DP formula.
//
// Two ideas, deliberately kept apart:
//   SALES  (cashSales, nonCashSales) — the FULL value of every order paid this
//          shift, recognised on the delivery day. Omzet, margin and per-channel
//          all read this, so a DP never makes revenue disagree between sections.
//   DRAWER (expectedCash) — only the cash that physically moved. A DP taken on
//          another day is inside cashSales but never reaches today's drawer; a
//          cash DP taken today is in the drawer but is not a sale.
//
// With no DP anywhere every DP term is 0, cashCollected === cashSales and the
// result is exactly the old  openingCash + cashSales - expenseTotal.
//
// Piutang settled this shift (25 Sep 2026) follows the same split: its sale is
// in cashSales/nonCashSales (recognised the day it is actually paid), and the
// only drawer term is the cash the owner took into the pocket instead of the
// drawer (receivablePocketCash). With no settled piutang those terms are 0 and
// every number is exactly what it was before.

export type ClosingOrder = {
  total: number;
  method: "CASH" | "QRIS" | "TRANSFER" | "SPLIT" | null;
  // DP applied to this order when it was paid (sum of its APPLIED entries).
  depositsApplied: number;
  // Only meaningful when method === "SPLIT" — the QRIS slice of what was
  // actually collected THIS payment (order.splitQrisAmount). The cash slice
  // is derived, never stored separately here (see qrisPortionOf below).
  splitQrisAmount?: number | null;
  // Present only for a piutang (RECEIVABLE) order settled in this shift.
  // cashToDrawer: where its cash slice went — the drawer (true) or the
  // owner's pocket (false, recorded as a sale but never in the drawer).
  settledReceivable?: { cashToDrawer: boolean } | null;
};

export type ClosingDepositEntry = {
  kind: "RECEIVED" | "APPLIED" | "REFUNDED" | "FORFEITED";
  method: "CASH" | "QRIS" | "TRANSFER";
  amount: number;
};

export type ClosingInput = {
  openingCash: number;
  paidOrders: readonly ClosingOrder[];
  expenseTotal: number;
  // Only the ledger entries stamped with THIS shift's id.
  depositEntries: readonly ClosingDepositEntry[];
};

export type ClosingNumbers = {
  cashSales: number;
  nonCashSales: number;
  expenseTotal: number;
  depositsAppliedCash: number;
  depositsReceivedCash: number;
  depositsReceivedNonCash: number;
  depositRefundsCash: number;
  depositRefundsNonCash: number;
  forfeitedDeposits: number;
  receivableSettledCash: number;
  receivableSettledNonCash: number;
  receivablePocketCash: number;
  // Cash that actually came in at the till for sales paid today.
  cashCollected: number;
  expectedCash: number;
};

const sum = (values: Iterable<number>) => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

// The QRIS-attributed slice of one order's total. CASH/SPLIT orders default
// the rest (including any DP riding along — see the module doc comment) into
// the cash side; only an order whose method is explicitly QRIS/TRANSFER, or
// the QRIS slice of a SPLIT order, ever counts here. This is the one place
// that generalizes "which bucket does this order's money belong to" — every
// sum below is built from it, so cashSales/nonCashSales/depositsAppliedCash
// can never disagree about a SPLIT order's split.
function qrisPortionOf(o: ClosingOrder): number {
  if (o.method === "QRIS" || o.method === "TRANSFER") return o.total;
  if (o.method === "SPLIT") return o.splitQrisAmount ?? 0;
  return 0;
}

// True for a CASH or SPLIT order — i.e. any order whose remainder wasn't
// paid wholly in QRIS. DP applied to such an order rides inside the cash
// side (see qrisPortionOf) exactly the way a plain CASH order already
// worked before SPLIT existed, so depositsAppliedCash below stays correct.
function isCashLike(method: ClosingOrder["method"]): boolean {
  return method === "CASH" || method === "SPLIT";
}

export function computeShiftClosing(input: ClosingInput): ClosingNumbers {
  // cashSales/nonCashSales: each order's total is divided between the two
  // by qrisPortionOf, so a SPLIT order lands its cash slice in one and its
  // QRIS slice in the other — counted once, together, never zero and never
  // twice (see qrisPortionOf's doc comment). With no SPLIT order anywhere
  // this reduces EXACTLY to the pre-SPLIT formula: a CASH order's qrisPortion
  // is 0 (all of it in cashSales), a QRIS order's is its whole total (all of
  // it in nonCashSales) — byte-identical to the old cashOrders/nonCashOrders
  // filter-and-sum.
  const cashSales = sum(input.paidOrders.map((o) => o.total - qrisPortionOf(o)));
  const nonCashSales = sum(input.paidOrders.map(qrisPortionOf));

  // Only DP applied to a cash-like order (CASH, or SPLIT whose cash slice
  // absorbs it — see isCashLike) sits inside cashSales; DP applied to a QRIS
  // order is inside nonCashSales and never was cash-in-drawer math. Same
  // rule as before SPLIT existed, just no longer keyed off a whole-order
  // CASH filter.
  const depositsAppliedCash = sum(
    input.paidOrders.filter((o) => isCashLike(o.method)).map((o) => o.depositsApplied),
  );
  // Piutang settled this shift. A piutang never holds DP (markOrderReceivable
  // refuses one), so these never overlap with the DP terms above.
  const settled = input.paidOrders.filter((o) => o.settledReceivable != null);
  const receivableSettledCash = sum(settled.map((o) => o.total - qrisPortionOf(o)));
  const receivableSettledNonCash = sum(settled.map(qrisPortionOf));
  const receivablePocketCash = sum(
    settled.filter((o) => !o.settledReceivable!.cashToDrawer).map((o) => o.total - qrisPortionOf(o)),
  );
  const cashCollected = cashSales - depositsAppliedCash - receivablePocketCash;

  const entries = (kind: ClosingDepositEntry["kind"], cash: boolean) =>
    sum(
      input.depositEntries
        .filter((e) => e.kind === kind && (e.method === "CASH") === cash)
        .map((e) => e.amount),
    );

  const depositsReceivedCash = entries("RECEIVED", true);
  const depositsReceivedNonCash = entries("RECEIVED", false);
  const depositRefundsCash = entries("REFUNDED", true);
  const depositRefundsNonCash = entries("REFUNDED", false);
  const forfeitedDeposits = sum(input.depositEntries.filter((e) => e.kind === "FORFEITED").map((e) => e.amount));

  const expectedCash =
    input.openingCash + cashCollected + depositsReceivedCash - depositRefundsCash - input.expenseTotal;

  return {
    cashSales,
    nonCashSales,
    expenseTotal: input.expenseTotal,
    depositsAppliedCash,
    depositsReceivedCash,
    depositsReceivedNonCash,
    depositRefundsCash,
    depositRefundsNonCash,
    forfeitedDeposits,
    receivableSettledCash,
    receivableSettledNonCash,
    receivablePocketCash,
    cashCollected,
    expectedCash,
  };
}
