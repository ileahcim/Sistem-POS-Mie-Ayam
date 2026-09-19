import type { ShiftHistoryRow } from "@/lib/dashboard/get-shift-history";
import { Card } from "@/components/ui/card";
import { formatRupiah } from "@/lib/printing/format";
import { cn } from "@/components/ui/cn";
import { formatId } from "@/lib/timezone";
import { TrendLineChart } from "./trend-line-chart";

function formatDate(iso: string): string {
  return formatId(new Date(iso), { dateStyle: "medium" });
}

function selisihClass(value: number): string {
  return value === 0 ? "text-ink" : value > 0 ? "text-primary-strong" : "text-danger";
}

// Section 1 (top priority — the owner's most-checked screen, per CLAUDE.md
// "Dashboard"). Every number comes straight from the frozen Shift row (see
// get-shift-history.ts) — never recomputed from Order. The trend chart
// exists instead of an invented "consistently minus" alert threshold: a
// small difference most days is normal, and the owner is better placed to
// eyeball a real pattern than a threshold picked without asking first.
export function ShiftHistorySection({ shifts }: { shifts: ShiftHistoryRow[] }) {
  const trendPoints = [...shifts]
    .reverse()
    .map((s) => ({ label: formatDate(s.closedAt), value: s.difference }));

  return (
    <section>
      <h2 className="text-ink mb-2 text-base font-bold">Riwayat Shift & Selisih Kas</h2>
      <Card padded className="mb-3">
        <p className="text-ink-muted mb-2 text-sm font-medium">
          Tren selisih ({shifts.length} shift terakhir)
        </p>
        <TrendLineChart points={trendPoints} minPointsMessage="Butuh minimal 2 shift untuk melihat tren." />
      </Card>

      <Card className="overflow-x-auto">
        {shifts.length === 0 ? (
          <p className="text-ink-faint py-12 text-center">Belum ada shift yang ditutup.</p>
        ) : (
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              {/* Same order and wording as the Tutup Shift result screen
                  (tutup-shift-flow.tsx), so the owner reads one story in both. */}
              <tr className="border-border text-ink-muted border-b text-left">
                <th className="px-3 py-2 font-medium">Tanggal</th>
                <th className="px-3 py-2 font-medium">Kasir</th>
                <th className="px-3 py-2 text-right font-medium">Modal Awal Laci</th>
                <th className="px-3 py-2 text-right font-medium">Penjualan Cash</th>
                <th className="px-3 py-2 text-right font-medium">Penjualan Non-Cash</th>
                <th className="px-3 py-2 text-right font-medium">Total Pengeluaran</th>
                <th className="px-3 py-2 text-right font-medium">Uang Seharusnya</th>
                <th className="px-3 py-2 text-right font-medium">Uang Fisik Dihitung</th>
                <th className="px-3 py-2 text-right font-medium">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 text-ink whitespace-nowrap">{formatDate(s.closedAt)}</td>
                  <td className="px-3 py-2 text-ink whitespace-nowrap">{s.openedByName}</td>
                  <td className="px-3 py-2 text-ink-muted text-right tabular-nums">{formatRupiah(s.openingCash)}</td>
                  <td className="px-3 py-2 text-ink-muted text-right tabular-nums">{formatRupiah(s.cashSales)}</td>
                  <td className="px-3 py-2 text-ink-muted text-right tabular-nums">{formatRupiah(s.nonCashSales)}</td>
                  <td className="px-3 py-2 text-ink-muted text-right tabular-nums">{formatRupiah(s.expenseTotal)}</td>
                  <td className="px-3 py-2 text-ink-muted text-right tabular-nums">{formatRupiah(s.expectedCash)}</td>
                  <td className="px-3 py-2 text-ink-muted text-right tabular-nums">{formatRupiah(s.countedCash)}</td>
                  <td className={cn("px-3 py-2 text-right font-bold tabular-nums", selisihClass(s.difference))}>
                    {s.difference > 0 ? "+" : ""}
                    {formatRupiah(s.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}
