// The customer-facing queue identity — "#18" normally, "#18-A" for a
// Pisahkan & Bayar child (see splitAndPay in order-aktif/actions.ts), which
// deliberately shares its parent's queueNumber rather than getting a new
// one. Every screen/receipt that shows a queue number goes through this
// instead of hand-rolling `#${queueNumber}`, so the suffix can never be
// forgotten in one spot.
export function formatQueueLabel(queueNumber: number | null, queueSuffix: string): string {
  if (queueNumber == null) return "—";
  return `#${queueNumber}${queueSuffix ? `-${queueSuffix}` : ""}`;
}
