import Link from "next/link";

// The "actually alarming" half of the tiered indicator (see
// OrderAktifButton) — a full-width bar, only rendered once at least one
// order has crossed 2x its prep estimate. Placed above every screen's own
// header so it's the first thing noticed regardless of which screen staff
// happen to be on when an order goes late.
export function LateOrderBanner({ lateCount }: { lateCount: number }) {
  if (lateCount === 0) return null;

  return (
    <Link
      href="/order-aktif"
      className="bg-danger flex items-center justify-center px-4 py-2 text-center text-sm font-bold text-white"
    >
      {lateCount} order sudah lewat 2x estimasi waktu masak — cek Order Aktif
    </Link>
  );
}
