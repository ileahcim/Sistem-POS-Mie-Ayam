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

export type ClosingOrder = {
  total: number;
  method: "CASH" | "QRIS" | "TRANSFER" | null;
  // DP applied to this order when it was paid (sum of its APPLIED entries).
  depositsApplied: number;
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
  // Cash that actually came in at the till for sales paid today.
  cashCollected: number;
  expectedCash: number;
};

const sum = (values: Iterable<number>) => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

export function computeShiftClosing(input: ClosingInput): ClosingNumbers {
  const cashOrders = input.paidOrders.filter((o) => o.method === "CASH");
  const nonCashOrders = input.paidOrders.filter((o) => o.method === "QRIS" || o.method === "TRANSFER");

  const cashSales = sum(cashOrders.map((o) => o.total));
  const nonCashSales = sum(nonCashOrders.map((o) => o.total));

  // Only DP applied to CASH-paid orders sits inside cashSales; DP applied to a
  // QRIS order is inside nonCashSales and never was cash-in-drawer math.
  const depositsAppliedCash = sum(cashOrders.map((o) => o.depositsApplied));
  const cashCollected = cashSales - depositsAppliedCash;

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
    cashCollected,
    expectedCash,
  };
}
