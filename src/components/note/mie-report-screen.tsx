"use client";

import { useMemo, useState } from "react";
import type { MieReportPoint } from "@/lib/mie/get-mie-report";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { bucketMie, defaultRangeFor, isDefaultRange, type MieGranularity } from "@/lib/mie/bucket-mie";
import { normalizeRange, type DateRange } from "@/lib/date-range/presets";
import { DateRangePresets } from "@/components/ui/date-range-presets";
import { formatId } from "@/lib/timezone";
import { MIE_MENTAH_PRODUCT_TYPES, MIE_PRODUCT_LABEL, type MieProductType } from "@/lib/mie/types";
import { formatRupiah } from "@/lib/printing/format";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { BarChart } from "@/components/dashboard/bar-chart";
import { cn } from "@/components/ui/cn";

const OPTIONS: { value: MieGranularity; label: string; unit: string }[] = [
  { value: "harian", label: "Harian", unit: "Hari" },
  { value: "mingguan", label: "Mingguan", unit: "Minggu" },
  { value: "bulanan", label: "Bulanan", unit: "Bulan" },
];

// FROZEN deliberately excluded — this table (and the Total row under it)
// is mi-mentah only, see bucket-mie.ts's MieBucket doc comment.
const TYPE_ROWS: { type: Exclude<MieProductType, "FROZEN">; label: string }[] = [
  ...MIE_MENTAH_PRODUCT_TYPES.map((t) => ({ type: t, label: MIE_PRODUCT_LABEL[t] })),
  { type: "CUSTOM", label: "Custom" },
];

function formatKg(kg: number): string {
  return `${(Math.round(kg * 100) / 100).toLocaleString("id-ID")} kg`;
}

function emptyTypeTotals(): Record<Exclude<MieProductType, "FROZEN">, { kg: number; amount: number }> {
  return {
    MIE_KERITING: { kg: 0, amount: 0 },
    MIE_LURUS: { kg: 0, amount: 0 },
    PANGSIT: { kg: 0, amount: 0 },
    CUSTOM: { kg: 0, amount: 0 },
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card padded className="flex min-w-[9.5rem] flex-1 flex-col gap-1">
      <span className="text-ink-muted text-xs font-medium">{label}</span>
      <span className="text-ink text-xl font-bold tabular-nums">{value}</span>
    </Card>
  );
}

function formatDay(day: string): string {
  // Noon-ish UTC so formatId (Asia/Jakarta) can't roll into the next day.
  const [y, m, d] = day.split("-").map(Number);
  return formatId(new Date(Date.UTC(y, m - 1, d, 5)), { day: "numeric", month: "long", year: "numeric" });
}

// Monitoring for the raw-noodle ledger only — its own data (get-mie-report),
// never mixed with the POS dashboard numbers. Only the generic BarChart
// drawing primitive is shared. Tap a period row to see its per-type
// breakdown; the newest period is selected by default.
//
// Two independent controls on top: the Harian/Mingguan/Bulanan buttons pick
// how days are grouped, and the dari–sampai range picks WHICH days. Every number below — omzet,
// pembayaran, kg, per-jenis, chart — comes from the same bucket list, so they
// can never disagree about the range.
export function MieReportScreen({
  points,
  today,
  nav,
}: {
  points: MieReportPoint[];
  today: string;
  nav: HeaderNav;
}) {
  const [granularity, setGranularity] = useState<MieGranularity>("harian");
  const [range, setRange] = useState<DateRange>(() => defaultRangeFor("harian", today));
  // null = the whole range (the default). Tapping a period row narrows the
  // headline numbers to that period; "Semua" puts them back.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const buckets = useMemo(() => bucketMie(points, granularity, range), [points, granularity, range]);
  const selected = buckets.find((b) => b.key === selectedKey) ?? null;
  const unit = OPTIONS.find((o) => o.value === granularity)!.unit;

  const safeRange = normalizeRange(range);
  const rangeLabel =
    safeRange.from === safeRange.to
      ? formatDay(safeRange.from)
      : `${formatDay(safeRange.from)} – ${formatDay(safeRange.to)}`;

  // The headline block: one period when a row is tapped, otherwise the whole
  // range — summed from the same buckets, so the two can never disagree.
  const view = useMemo(() => {
    if (selected) return { ...selected, label: selected.longLabel };
    const totals = { omzet: 0, payments: 0, kg: 0, frozenKg: 0, frozenAmount: 0, byType: emptyTypeTotals() };
    for (const b of buckets) {
      totals.omzet += b.omzet;
      totals.payments += b.payments;
      totals.kg += b.kg;
      totals.frozenKg += b.frozenKg;
      totals.frozenAmount += b.frozenAmount;
      for (const row of TYPE_ROWS) {
        totals.byType[row.type].kg += b.byType[row.type].kg;
        totals.byType[row.type].amount += b.byType[row.type].amount;
      }
    }
    return { label: rangeLabel, ...totals };
  }, [selected, buckets, rangeLabel]);

  function pickRange(next: DateRange) {
    setRange(next);
    setSelectedKey(null);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Ringkasan Mi Mentah"
        actions={
          <LinkButton href="/note" variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Card padded className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div
                className="rounded-pill bg-muted flex h-12 items-center p-1"
                role="group"
                aria-label="Kelompokkan per"
              >
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={granularity === opt.value}
                    onClick={() => {
                      // An untouched range follows the view (so Bulanan doesn't
                      // open on one lone bar), but a range the owner picked
                      // themselves is kept — switching to Bulanan is exactly how
                      // you'd want to read a long custom range.
                      const untouched = isDefaultRange(range, granularity, today);
                      setGranularity(opt.value);
                      if (untouched) setRange(defaultRangeFor(opt.value, today));
                      setSelectedKey(null);
                    }}
                    className={cn(
                      "rounded-pill h-10 px-4 text-sm font-semibold",
                      granularity === opt.value ? "bg-surface text-ink shadow-card" : "text-ink-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted font-medium">Dari</span>
                <input
                  type="date"
                  value={range.from}
                  max={today}
                  onChange={(e) => e.target.value && pickRange({ ...range, from: e.target.value })}
                  className="rounded-input border-border h-12 border px-3 text-base"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted font-medium">Sampai</span>
                <input
                  type="date"
                  value={range.to}
                  max={today}
                  onChange={(e) => e.target.value && pickRange({ ...range, to: e.target.value })}
                  className="rounded-input border-border h-12 border px-3 text-base"
                />
              </label>
            </div>

            <DateRangePresets today={today} value={safeRange} onPick={pickRange} />
          </Card>

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-ink text-base font-bold">{view.label}</h2>
              {selected && (
                <button
                  type="button"
                  onClick={() => setSelectedKey(null)}
                  className="rounded-pill border-border text-ink bg-surface h-10 border px-4 text-sm font-semibold"
                >
                  Semua ({rangeLabel})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Stat label="Omzet (pesanan)" value={formatRupiah(view.omzet)} />
              <Stat label="Pembayaran diterima" value={formatRupiah(view.payments)} />
              <Stat label="Mi terjual" value={formatKg(view.kg)} />
            </div>
            {/* Mie Frozen is a warung POS product, not mi mentah — tracked as
                debt but shown separately, never folded into Omzet/Mi terjual
                above (owner's call, 22 Sep 2026). */}
            {view.frozenAmount > 0 && (
              <div className="flex flex-wrap gap-3">
                <Stat label="Frozen (di luar mi mentah)" value={`${formatRupiah(view.frozenAmount)} · ${formatKg(view.frozenKg)}`} />
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-ink text-base font-bold">Per jenis mi</h2>
            <Card>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-ink-muted border-border border-b text-left text-xs">
                    <th className="px-4 py-2 font-medium">Jenis</th>
                    <th className="px-4 py-2 text-right font-medium">Kg</th>
                    <th className="px-4 py-2 text-right font-medium">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {TYPE_ROWS.map(({ type, label }) => (
                    <tr key={type} className="border-border border-b">
                      <td className="text-ink px-4 py-3 font-semibold">{label}</td>
                      <td className="text-ink px-4 py-3 text-right">{formatKg(view.byType[type].kg)}</td>
                      <td className="text-ink px-4 py-3 text-right">{formatRupiah(view.byType[type].amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="text-ink px-4 py-3 font-bold">Total</td>
                    <td className="text-ink px-4 py-3 text-right font-bold">{formatKg(view.kg)}</td>
                    <td className="text-ink px-4 py-3 text-right font-bold">{formatRupiah(view.omzet)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-ink text-base font-bold">Omzet per {unit.toLowerCase()}</h2>
            <Card padded className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-ink-muted">{rangeLabel}</span>
              </div>
              <BarChart bars={buckets.map((b) => ({ label: b.label, value: b.omzet }))} />
            </Card>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-ink text-base font-bold">Rincian per {unit.toLowerCase()}</h2>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm tabular-nums">
                <thead>
                  <tr className="text-ink-muted border-border border-b text-left text-xs">
                    <th className="px-4 py-2 font-medium">{unit}</th>
                    <th className="px-4 py-2 text-right font-medium">Omzet</th>
                    <th className="px-4 py-2 text-right font-medium">Pembayaran</th>
                    <th className="px-4 py-2 text-right font-medium">Kg</th>
                  </tr>
                </thead>
                <tbody>
                  {[...buckets].reverse().map((b) => (
                    <tr
                      key={b.key}
                      onClick={() => setSelectedKey(b.key)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedKey(b.key)}
                      tabIndex={0}
                      aria-selected={b.key === selected?.key}
                      className={cn(
                        "border-border h-12 cursor-pointer border-b last:border-b-0",
                        b.key === selected?.key && "bg-primary-soft",
                      )}
                    >
                      <td className="text-ink px-4 font-semibold">{b.longLabel}</td>
                      <td className="text-ink px-4 text-right">{formatRupiah(b.omzet)}</td>
                      <td className="text-ink px-4 text-right">{formatRupiah(b.payments)}</td>
                      <td className="text-ink px-4 text-right">{formatKg(b.kg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <p className="text-ink-faint text-xs">
              Ketuk baris untuk melihat rincian per jenis mi periode itu. Kalau rentang tanggal berhenti di tengah
              minggu/bulan, periode di tepi hanya menghitung hari yang masuk rentang. Omzet dihitung dari semua
              pesanan (bukan cuma yang belum lunas); saldo awal dan koreksi tidak dihitung sebagai omzet maupun
              pembayaran.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
