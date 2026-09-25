"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { FrozenReportPoint } from "@/lib/frozen/get-frozen-report";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { bucketFrozen, defaultRangeFor, isDefaultRange, type FrozenGranularity } from "@/lib/frozen/bucket-frozen";
import { normalizeRange, type DateRange } from "@/lib/date-range/presets";
import { DateRangePresets } from "@/components/ui/date-range-presets";
import { formatId } from "@/lib/timezone";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import { formatRupiah } from "@/lib/printing/format";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { NOTE_BOOK } from "@/lib/note/books";
import { NoteNav } from "./note-nav";
import { BarChart } from "@/components/dashboard/bar-chart";
import { cn } from "@/components/ui/cn";
import { DrilldownStat, LedgerDrilldown, type DrilldownRow } from "./ledger-drilldown";
import { FrozenEntrySheet } from "./frozen-sheets";

// Mirrors mie-report-screen.tsx's Drill: "omzet" and "pcs" open the same
// pengambilan rows, only the emphasised number differs.
type Drill = "omzet" | "payments" | "pcs";

const OPTIONS: { value: FrozenGranularity; label: string; unit: string }[] = [
  { value: "harian", label: "Harian", unit: "Hari" },
  { value: "mingguan", label: "Mingguan", unit: "Minggu" },
  { value: "bulanan", label: "Bulanan", unit: "Bulan" },
];

function formatPcs(pcs: number): string {
  return `${pcs.toLocaleString("id-ID")} pcs`;
}

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return formatId(new Date(Date.UTC(y, m - 1, d, 5)), { day: "numeric", month: "long", year: "numeric" });
}

// Monitoring for the Buku Frozen only — its own data (get-frozen-report),
// never mixed with Mi Mentah or the POS dashboard. Mirrors mie-report-
// screen.tsx but drops the "Per jenis mi" table: Frozen has no jenis at all.
export function FrozenReportScreen({
  points,
  today,
  nav,
}: {
  points: FrozenReportPoint[];
  today: string;
  nav: HeaderNav;
}) {
  const [granularity, setGranularity] = useState<FrozenGranularity>("harian");
  const [range, setRange] = useState<DateRange>(() => defaultRangeFor("harian", today));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  // Opens the same FrozenEntrySheet the customer detail page opens — one
  // edit/delete path, one set of rules. Its router.refresh() re-reads the
  // points, so the cards above follow the change on their own.
  const [editing, setEditing] = useState<{ point: FrozenReportPoint; action: "edit" | "delete" } | null>(null);
  const buckets = useMemo(() => bucketFrozen(points, granularity, range), [points, granularity, range]);
  const selected = buckets.find((b) => b.key === selectedKey) ?? null;
  const unit = OPTIONS.find((o) => o.value === granularity)!.unit;

  const safeRange = normalizeRange(range);
  const rangeLabel =
    safeRange.from === safeRange.to
      ? formatDay(safeRange.from)
      : `${formatDay(safeRange.from)} – ${formatDay(safeRange.to)}`;

  const view = useMemo(() => {
    if (selected) return { ...selected, label: selected.longLabel };
    const totals = {
      omzet: 0,
      payments: 0,
      pcs: 0,
      orderRows: [] as FrozenReportPoint[],
      paymentRows: [] as FrozenReportPoint[],
    };
    for (const b of buckets) {
      totals.omzet += b.omzet;
      totals.payments += b.payments;
      totals.pcs += b.pcs;
      totals.orderRows.push(...b.orderRows);
      totals.paymentRows.push(...b.paymentRows);
    }
    return { label: rangeLabel, ...totals };
  }, [selected, buckets, rangeLabel]);

  // Newest first — the exact rows the open card's number was summed from.
  const drillPoints = useMemo(() => {
    if (!drill) return [];
    const source = drill === "payments" ? view.paymentRows : view.orderRows;
    return [...source].sort((a, b) => (a.day === b.day ? b.time.localeCompare(a.time) : b.day.localeCompare(a.day)));
  }, [drill, view]);

  const drillRows: DrilldownRow[] = drillPoints.map((p) => {
    const pcsLabel = p.pcs != null ? formatPcs(p.pcs) : null;
    const perPcs =
      p.pcs != null && p.pricePerPcs != null
        ? `${pcsLabel} × Rp${p.pricePerPcs.toLocaleString("id-ID")}/pcs`
        : null;
    return {
      id: p.id,
      href: `/note/frozen/pelanggan/${p.customerId}`,
      title: p.customerName,
      date: p.date,
      time: p.time,
      // See mie-report-screen.tsx — "Tidak dicatat" for pre-column rows.
      detail: drill === "payments" ? formatNotePaymentMethod(p.paymentMethod) : perPcs,
      note: p.note,
      value: drill === "pcs" ? (pcsLabel ?? "—") : formatRupiah(p.amount),
      sub: drill === "pcs" ? formatRupiah(p.amount) : null,
    };
  });

  const DRILL_META: Record<Drill, { heading: string; totalLabel: string; totalValue: string; empty: string }> = {
    omzet: {
      heading: "Pengambilan",
      totalLabel: "Total omzet",
      totalValue: formatRupiah(view.omzet),
      empty: "Tidak ada pengambilan di rentang ini.",
    },
    payments: {
      heading: "Pembayaran diterima",
      totalLabel: "Total pembayaran",
      totalValue: formatRupiah(view.payments),
      empty: "Tidak ada pembayaran di rentang ini.",
    },
    pcs: {
      heading: "Pcs terjual",
      totalLabel: "Total pcs",
      totalValue: formatPcs(view.pcs),
      empty: "Tidak ada pengambilan di rentang ini.",
    },
  };

  function openEntry(id: string, action: "edit" | "delete") {
    const point = drillPoints.find((p) => p.id === id);
    if (point) setEditing({ point, action });
  }

  function pickRange(next: DateRange) {
    setRange(next);
    setSelectedKey(null);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title={NOTE_BOOK.frozen.title} />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <NoteNav book="frozen" section="ringkasan" />
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
              <DrilldownStat
                label="Omzet (pengambilan)"
                value={formatRupiah(view.omzet)}
                open={drill === "omzet"}
                onToggle={() => setDrill(drill === "omzet" ? null : "omzet")}
              />
              <DrilldownStat
                label="Pembayaran diterima"
                value={formatRupiah(view.payments)}
                open={drill === "payments"}
                onToggle={() => setDrill(drill === "payments" ? null : "payments")}
              />
              <DrilldownStat
                label="Pcs terjual"
                value={formatPcs(view.pcs)}
                open={drill === "pcs"}
                onToggle={() => setDrill(drill === "pcs" ? null : "pcs")}
              />
            </div>
          </section>

          {drill && (
            <LedgerDrilldown
              heading={`${DRILL_META[drill].heading} · ${view.label}`}
              rows={drillRows}
              totalLabel={DRILL_META[drill].totalLabel}
              totalValue={DRILL_META[drill].totalValue}
              emptyText={DRILL_META[drill].empty}
              footnote="Ketuk nama pelanggan untuk membuka riwayat lengkapnya. Jam yang tampil adalah jam pencatatan. Edit dan hapus di sini sama persis dengan yang ada di halaman pelanggan — saldo berjalan baris sesudahnya ikut berubah, dan baris yang dihapus hilang permanen."
              onEdit={(id) => openEntry(id, "edit")}
              onDelete={(id) => openEntry(id, "delete")}
              onClose={() => setDrill(null)}
            />
          )}

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
                    <th className="px-4 py-2 text-right font-medium">Pcs</th>
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
                      <td className="text-ink px-4 text-right">{formatPcs(b.pcs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <p className="text-ink-faint text-xs">
              Ketuk baris untuk melihat rincian periode itu. Kalau rentang tanggal berhenti di tengah minggu/bulan,
              periode di tepi hanya menghitung hari yang masuk rentang. Omzet dihitung dari semua pengambilan (bukan
              cuma yang belum lunas); saldo awal dan koreksi tidak dihitung sebagai omzet maupun pembayaran.
            </p>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <FrozenEntrySheet
            key={editing.point.id}
            entry={editing.point}
            initialAction={editing.action}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
