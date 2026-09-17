// price==0 happens for a zero-delta addon option (no markup on top of the base price) — margin %
// is meaningless there (nothing sold to take a percentage of), so this
// returns null rather than dividing by zero.
export function computeMarginPercent(price: number, costPrice: number): number | null {
  if (price <= 0) return null;
  return Math.round(((price - costPrice) / price) * 100);
}
