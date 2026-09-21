import type { ShiftHistoryRow } from "@/lib/dashboard/get-shift-history";
import { Card } from "@/components/ui/card";
import { formatId } from "@/lib/timezone";
import { TrendLineChart } from "./trend-line-chart";
import { ShiftHistoryList } from "./shift-history-list";

function formatDate(iso: string): string {
  return formatId(new Date(iso), { dateStyle: "medium" });
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

      <Card>
        {shifts.length === 0 ? (
          <p className="text-ink-faint py-12 text-center">Belum ada shift yang ditutup.</p>
        ) : (
          <ShiftHistoryList shifts={shifts} />
        )}
      </Card>
    </section>
  );
}
