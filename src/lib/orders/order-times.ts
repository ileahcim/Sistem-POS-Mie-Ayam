import { formatId } from "@/lib/timezone";

// The "when" line of a Riwayat Pesanan row and its detail page — one helper so
// the two can't drift. "Dipesan" is when the order was created; the second
// time is how it concluded (there's no single "Dibayar" for an order that was
// never paid).
//
// A pre-order (scheduledFor set — it came from Pesanan Terjadwal) is often
// taken the night before and paid on the delivery day, so BOTH times carry
// their date: "Dipesan 25 Sep 03.14 · Dibayar 25 Sep 03.49". A regular
// order keeps its old compact form (full date once, then just the clock).
type OrderTimes = {
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  scheduledFor: string | null;
};

function dayAndTime(iso: string): string {
  const d = new Date(iso);
  return `${formatId(d, { day: "numeric", month: "short" })} ${formatId(d, { timeStyle: "short" })}`;
}

export function orderTimesLabel(order: OrderTimes): string {
  const preorder = order.scheduledFor != null;
  const fmt = (iso: string) => (preorder ? dayAndTime(iso) : formatId(new Date(iso), { timeStyle: "short" }));
  const first = `Dipesan ${preorder ? dayAndTime(order.createdAt) : formatId(new Date(order.createdAt), { dateStyle: "medium", timeStyle: "short" })}`;
  const second = order.paidAt
    ? `Dibayar ${fmt(order.paidAt)}`
    : order.cancelledAt
      ? `Dibatalkan ${fmt(order.cancelledAt)}`
      : null;
  return second ? `${first} · ${second}` : first;
}

// "Kirim 25 Sep 04.00" — a pre-order's scheduled delivery time.
export function scheduledForLabel(scheduledFor: string): string {
  return `Jadwal kirim ${dayAndTime(scheduledFor)}`;
}
