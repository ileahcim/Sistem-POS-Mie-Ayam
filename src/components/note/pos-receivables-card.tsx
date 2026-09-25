import Link from "next/link";
import type { PosReceivableRow } from "@/lib/orders/get-pos-receivables-by-name";
import { formatRupiah } from "@/lib/printing/format";
import { formatId } from "@/lib/timezone";
import { Card } from "@/components/ui/card";

// Shown on a Mi Mentah / Frozen customer page when the same name also owes
// the warung for menu orders marked piutang in the POS. Display only: never
// added into this book's "Sisa utang" (the books stay separate), and each
// order is its own tappable row — opening the order in Riwayat Pesanan, with
// its items, prices and number intact — rather than one merged amount.
export function PosReceivablesCard({ rows }: { rows: PosReceivableRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card className="border-warning border">
      <div className="px-4 pt-3 pb-1">
        <p className="text-warning text-sm font-bold">Juga punya piutang menu warung</p>
        <p className="text-ink-faint text-xs">
          Tidak ikut dihitung di sisa utang buku ini. Dilunasi dari halaman Piutang (kasir).
        </p>
      </div>
      {rows.map((r) => (
        <Link
          key={r.id}
          href={`/riwayat-pesanan/${r.id}`}
          className="border-border hover:bg-muted flex min-h-12 items-center justify-between gap-3 border-t px-4 py-2"
        >
          <span className="text-ink text-sm font-semibold">
            Order #{r.orderNumber} · {formatId(new Date(r.createdAt), { day: "numeric", month: "short" })}
          </span>
          <span className="text-ink text-base font-semibold tabular-nums">{formatRupiah(r.total)}</span>
        </Link>
      ))}
    </Card>
  );
}
