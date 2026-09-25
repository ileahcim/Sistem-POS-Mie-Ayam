// One row of "Aktivitas Hari Ini" on /note and /note/frozen (25 Sep 2026):
// every pesanan/pengambilan and pembayaran RECORDED today (createdAt, WIB),
// newest first, regardless of the customer's balance now — so a customer who
// ordered and paid in full the same day, and so sank out of "Utang
// terbesar", is still one glance away. Same shape for both books; each book
// has its own loader (get-mie-today-activity.ts / get-frozen-today-activity.ts).
export type TodayActivityRow = {
  id: string;
  customerId: string;
  customerName: string;
  kind: "ORDER" | "PAYMENT";
  kindLabel: string; // "Pesanan" / "Pengambilan" / "Pembayaran"
  detail: string | null; // e.g. "Mi Keriting · 10 kg", "7 pcs", "Cash"
  amount: number;
  time: string; // "HH.MM" Jakarta, when it was recorded
  createdAt: string; // ISO, for ordering
};
