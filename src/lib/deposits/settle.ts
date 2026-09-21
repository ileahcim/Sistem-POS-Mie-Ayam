// Pre-order DP (uang muka) arithmetic. Pure — no Prisma, no React — so the
// payment screen, the receipt layout, the server actions and the tests all read
// the very same numbers instead of each re-deriving "sisa" their own way.

export type DepositMethod = "CASH" | "QRIS";

export const DEPOSIT_METHODS: readonly DepositMethod[] = ["CASH", "QRIS"];

export const DEPOSIT_METHOD_LABEL: Record<DepositMethod, string> = {
  CASH: "Cash",
  QRIS: "QRIS",
};

export function isDepositMethod(value: unknown): value is DepositMethod {
  return value === "CASH" || value === "QRIS";
}

// Where an order stands against the DP it holds. `remainder` is what still has
// to be collected at the till; `excess` is DP that is now MORE than the order
// (items were removed after the DP was taken) and has to be handed back — never
// silently rounded to zero. At most one of the two is non-zero.
export type DepositPosition = { held: number; remainder: number; excess: number };

export function depositPosition(total: number, heldAmounts: readonly number[]): DepositPosition {
  const held = heldAmounts.reduce((sum, amount) => sum + amount, 0);
  return { held, remainder: Math.max(0, total - held), excess: Math.max(0, held - total) };
}

export type HeldDeposit = { id: string; method: DepositMethod; amount: number };
export type DepositSlice = { depositId: string; method: DepositMethod; amount: number };

// Splits the DP an order holds across the sale it is being paid against.
// `deposits` must be in the order they were received. The OLDEST DP is applied
// first; whatever does not fit (`excess`) therefore comes off the NEWEST, and is
// handed back the way it came in — a QRIS DP is refunded as QRIS, cash as cash —
// which is what decides whether the drawer is touched (see shift-math.ts).
export function allocateDeposits(
  total: number,
  deposits: readonly HeldDeposit[],
): { applied: DepositSlice[]; refunded: DepositSlice[]; remainder: number } {
  let toApply = Math.min(total, deposits.reduce((sum, d) => sum + d.amount, 0));
  const remainder = total - toApply;
  const applied: DepositSlice[] = [];
  const refunded: DepositSlice[] = [];

  for (const deposit of deposits) {
    const take = Math.min(deposit.amount, toApply);
    toApply -= take;
    if (take > 0) applied.push({ depositId: deposit.id, method: deposit.method, amount: take });
    const left = deposit.amount - take;
    if (left > 0) refunded.push({ depositId: deposit.id, method: deposit.method, amount: left });
  }
  return { applied, refunded, remainder };
}

// Order.paymentMethod when nothing is left to collect (the DP covered the whole
// order): the method that paid for most of it, the more recent one on a tie.
// Only ever a label — with nothing collected at the till the drawer math cannot
// depend on it (see computeShiftClosing).
export function methodWhenFullyPrepaid(applied: readonly DepositSlice[]): DepositMethod {
  const totals: Record<DepositMethod, number> = { CASH: 0, QRIS: 0 };
  let best: DepositMethod = "CASH";
  let bestAmount = -1;
  for (const slice of applied) totals[slice.method] += slice.amount;
  // Walk in receive order so a tie is won by the later deposit.
  for (const slice of applied) {
    if (totals[slice.method] >= bestAmount) {
      best = slice.method;
      bestAmount = totals[slice.method];
    }
  }
  return best;
}
