// Shared by the Order Aktif row's own timer color (order-row.tsx) and the
// app-wide header indicator (get-order-aktif-indicator.ts) — one definition
// of "late" so a header badge can never disagree with what the Order Aktif
// list itself shows. See CLAUDE.md "Order Aktif — timer".
export function computeEstimateMinutes(
  prepBaseMinutes: number,
  prepMinutesPerPortion: number,
  portionsToCook: number,
): number {
  return prepBaseMinutes + prepMinutesPerPortion * portionsToCook;
}

export function elapsedMinutes(createdAt: Date | string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000));
}

export function isLateOrder(elapsedMin: number, estimateMin: number): boolean {
  return elapsedMin >= estimateMin * 2;
}
