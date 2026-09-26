"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { MieReportPoint } from "@/lib/mie/get-mie-report";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import {
  MIE_JENIS_KEYS,
  addTypeTotals,
  bucketMie,
  defaultRangeFor,
  emptyTypeTotals,
  isDefaultRange,
  type MieGranularity,
  type MieJenisKey,
} from "@/lib/mie/bucket-mie";
import { normalizeRange, type DateRange } from "@/lib/date-range/presets";
import { DateRangePresets } from "@/components/ui/date-range-presets";
import { formatId } from "@/lib/timezone";
import {
  MIE_COST_KEY_LABEL,
  formatMieEntryLabel,
  mieCostKeyOf,
  mieOrderMargin,
  type MieCosts,
} from "@/lib/mie/types";
import { formatNotePaymentMethod } from "@/lib/note/payment-method";
import { formatRupiah } from "@/lib/printing/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AppHeader } from "@/components/ui/app-header";
import { NOTE_BOOK } from "@/lib/note/books";
import { NoteNav } from "./note-nav";
import { BarChart } from "@/components/dashboard/bar-chart";
import { cn } from "@/components/ui/cn";
import { ReportGranularityToggle, GRANULARITY_OPTIONS, effectiveGranularity } from "./report-granularity";
import {
  DrilldownStat,
  LedgerDrilldown,
  ReturnBreakdown,
  summarizeReturns,
  type DrilldownRow,
} from "./ledger-drilldown";
import { EntrySheet } from "./mie-sheets";

// Which stat card's list is open. "omzet" and "kg" show the SAME ledger
// rows (every pesanan in range) — only which number is emphasised differs,
// exactly as the owner asked ("daftar yang sama, fokus ke kolom kg").
// "margin" lists the same pesanan again, each with its own margin (or why it
// has none). A retur sits in those lists too, as a minus row, because the
// numbers are net of retur (bucket-mie.ts) and each list's Total must equal
// its card. "returns" is the Retur card: who gave mi back, then the rows.
type Drill = "omzet" | "payments" | "kg" | "margin" | "returns";

// "−Rp70.000" / "−5 kg" for a retur row in the omzet/kg/margin lists.
const minus = (text: string) => `−${text}`;

const JENIS_LABEL: Record<MieJenisKey, string> = { ...MIE_COST_KEY_LABEL, CUSTOM: "Custom" };

function formatKg(kg: number): string {
  return `${(Math.round(kg * 100) / 100).toLocaleString("id-ID")} kg`;
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
  costs,
  nav,
}: {
  points: MieReportPoint[];
  today: string;
  costs: MieCosts;
  nav: HeaderNav;
}) {
  const [granularity, setGranularity] = useState<MieGranularity>("harian");
  const [range, setRange] = useState<DateRange>(() => defaultRangeFor("harian", today));
  // null = the whole range (the default). Tapping a period row narrows the
  // headline numbers to that period; "Semua" puts them back.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  // The row whose Edit/Hapus was tapped — opens the very same EntrySheet the
  // customer detail page opens, so there is one edit/delete path with one set
  // of rules. Its router.refresh() re-reads the page's points, and the cards
  // above recompute from those, which is why they follow along on their own.
  const [editing, setEditing] = useState<{ point: MieReportPoint; action: "edit" | "delete" } | null>(null);
  // A one-day range has nothing to group — see effectiveGranularity.
  const grouping = effectiveGranularity(granularity, range.from, range.to);
  const buckets = useMemo(() => bucketMie(points, grouping, range, costs), [points, grouping, range, costs]);
  const selected = buckets.find((b) => b.key === selectedKey) ?? null;
  const unit = GRANULARITY_OPTIONS.find((o) => o.value === grouping)!.unit;

  const safeRange = normalizeRange(range);
  const rangeLabel =
    safeRange.from === safeRange.to
      ? formatDay(safeRange.from)
      : `${formatDay(safeRange.from)} – ${formatDay(safeRange.to)}`;

  // The headline block: one period when a row is tapped, otherwise the whole
  // range — summed from the same buckets, so the two can never disagree.
  const view = useMemo(() => {
    if (selected) return { ...selected, label: selected.longLabel };
    const totals = {
      omzet: 0,
      payments: 0,
      kg: 0,
      returns: 0,
      returnKg: 0,
      margin: 0,
      byType: emptyTypeTotals(),
      orderRows: [] as MieReportPoint[],
      paymentRows: [] as MieReportPoint[],
      returnRows: [] as MieReportPoint[],
    };
    for (const b of buckets) {
      totals.omzet += b.omzet;
      totals.payments += b.payments;
      totals.kg += b.kg;
      totals.returns += b.returns;
      totals.returnKg += b.returnKg;
      totals.margin += b.margin;
      totals.orderRows.push(...b.orderRows);
      totals.paymentRows.push(...b.paymentRows);
      totals.returnRows.push(...b.returnRows);
      for (const key of MIE_JENIS_KEYS) addTypeTotals(totals.byType[key], b.byType[key]);
    }
    return { label: rangeLabel, ...totals };
  }, [selected, buckets, rangeLabel]);

  // Newest first. These are the exact rows the open card's number was summed
  // from (bucket-mie.ts collects them in the same branch that adds to the
  // total), so the list's own Total line can never disagree with the card.
  const drillPoints = useMemo(() => {
    if (!drill) return [];
    const source = drill === "payments" ? view.paymentRows : drill === "returns" ? view.returnRows : view.orderRows;
    return [...source].sort((a, b) => (a.day === b.day ? b.time.localeCompare(a.time) : b.day.localeCompare(a.day)));
  }, [drill, view]);

  // Pesanan left out of the margin, per jenis — the owner must see that the
  // Margin number is incomplete and why, never a silently bigger margin.
  const noCostJenis = MIE_JENIS_KEYS.filter((k) => view.byType[k].noCost.count > 0);
  const noCostCount = noCostJenis.reduce((n, k) => n + view.byType[k].noCost.count, 0);

  const returnSummary = useMemo(
    () =>
      drill === "returns"
        ? summarizeReturns(
            view.returnRows.map((p) => ({ ...p, qty: p.kg ?? 0 })),
            view.orderRows.map((p) => ({ ...p, qty: p.kg ?? 0 })),
          )
        : [],
    [drill, view],
  );

  const drillRows: DrilldownRow[] = drillPoints.map((p) => {
    const isReturn = p.kind === "RETURN" && drill !== "returns";
    const kgLabel = p.kg != null ? `${p.kg.toLocaleString("id-ID")} kg` : null;
    const perKg =
      p.kg != null && p.pricePerKg != null
        ? `${formatMieEntryLabel(p)} · ${kgLabel} × Rp${p.pricePerKg.toLocaleString("id-ID")}/kg`
        : null;
    if (drill === "margin") {
      const costKey = mieCostKeyOf(p);
      const cost = costKey ? costs[costKey] : null;
      const margin = mieOrderMargin(p, costs);
      return {
        id: p.id,
        href: `/note/pelanggan/${p.customerId}`,
        title: p.customerName,
        date: p.date,
        time: p.time,
        detail: perKg ? `${perKg} · modal ${cost != null ? `Rp${cost.toLocaleString("id-ID")}/kg` : "belum diisi"}` : null,
        note: p.note,
        value:
          margin != null
            ? isReturn
              ? minus(formatRupiah(margin))
              : formatRupiah(margin)
            : costKey
              ? "Modal belum diisi"
              : "Tanpa modal (custom)",
        sub: isReturn ? minus(formatRupiah(p.amount)) : formatRupiah(p.amount),
      };
    }
    if (drill === "returns") {
      return {
        id: p.id,
        href: `/note/pelanggan/${p.customerId}`,
        title: p.customerName,
        date: p.date,
        time: p.time,
        detail: perKg,
        note: p.note,
        value: kgLabel ?? "—",
        sub: formatRupiah(p.amount),
      };
    }
    return {
      id: p.id,
      href: `/note/pelanggan/${p.customerId}`,
      title: p.customerName,
      date: p.date,
      time: p.time,
      // Payments show their method here — "Tidak dicatat" for rows recorded
      // before the column existed, never silently blank and never guessed.
      detail: drill === "payments" ? formatNotePaymentMethod(p.paymentMethod) : perKg,
      note: p.note,
      value: drill === "kg" ? (kgLabel ? (isReturn ? minus(kgLabel) : kgLabel) : "—") : isReturn ? minus(formatRupiah(p.amount)) : formatRupiah(p.amount),
      sub: drill === "kg" ? (isReturn ? minus(formatRupiah(p.amount)) : formatRupiah(p.amount)) : null,
    };
  });

  const DRILL_META: Record<Drill, { heading: string; totalLabel: string; totalValue: string; empty: string }> = {
    omzet: {
      heading: view.returnRows.length > 0 ? "Pesanan & retur" : "Pesanan",
      totalLabel: view.returnRows.length > 0 ? "Total omzet (bersih)" : "Total omzet",
      totalValue: formatRupiah(view.omzet),
      empty: "Tidak ada pesanan di rentang ini.",
    },
    payments: {
      heading: "Pembayaran diterima",
      totalLabel: "Total pembayaran",
      totalValue: formatRupiah(view.payments),
      empty: "Tidak ada pembayaran di rentang ini.",
    },
    margin: {
      heading: "Margin per pesanan",
      totalLabel: noCostCount > 0 ? `Total margin (tanpa ${noCostCount} pesanan)` : "Total margin",
      totalValue: formatRupiah(view.margin),
      empty: "Tidak ada pesanan di rentang ini.",
    },
    returns: {
      heading: "Rincian retur",
      totalLabel: "Total retur",
      totalValue: `${formatKg(view.returnKg)} · ${formatRupiah(view.returns)}`,
      empty: "Tidak ada retur di rentang ini.",
    },
    kg: {
      heading: view.returnRows.length > 0 ? "Mi terjual & retur" : "Mi terjual",
      totalLabel: view.returnRows.length > 0 ? "Total kg (bersih)" : "Total kg",
      totalValue: formatKg(view.kg),
      empty: "Tidak ada pesanan di rentang ini.",
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
      <AppHeader nav={nav} title={NOTE_BOOK.mie.title} />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <NoteNav book="mie" section="ringkasan" />
          <Card padded className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
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
                label="Omzet (pesanan)"
                value={formatRupiah(view.omzet)}
                hint={view.returns > 0 ? `sudah dikurangi retur ${formatRupiah(view.returns)}` : null}
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
                label="Margin"
                value={formatRupiah(view.margin)}
                open={drill === "margin"}
                onToggle={() => setDrill(drill === "margin" ? null : "margin")}
                warning={noCostCount > 0 ? `Tanpa ${noCostCount} pesanan (modal tidak ada)` : null}
              />
              <DrilldownStat
                label="Mi terjual"
                value={formatKg(view.kg)}
                hint={view.returnKg > 0 ? `sudah dikurangi retur ${formatKg(view.returnKg)}` : null}
                open={drill === "kg"}
                onToggle={() => setDrill(drill === "kg" ? null : "kg")}
              />
              <DrilldownStat
                label="Retur"
                value={formatKg(view.returnKg)}
                hint={formatRupiah(view.returns)}
                open={drill === "returns"}
                onToggle={() => setDrill(drill === "returns" ? null : "returns")}
              />
            </div>
          </section>

          {noCostJenis.length > 0 && (
            <div className="bg-warning-soft text-warning rounded-card flex flex-col gap-1 px-3 py-2 text-sm font-medium">
              {noCostJenis.map((k) => {
                const n = view.byType[k].noCost;
                const what = `${n.count} pesanan (${formatKg(n.kg)}, ${formatRupiah(n.amount)})`;
                return (
                  <p key={k}>
                    {k === "CUSTOM"
                      ? `Pesanan Custom tidak punya modal per kg — ${what} tidak dihitung marginnya.`
                      : `Modal per kg ${JENIS_LABEL[k]} belum diisi — ${what} tidak dihitung marginnya (bukan dianggap modal Rp0).`}
                  </p>
                );
              })}
              {noCostJenis.some((k) => k !== "CUSTOM") && (
                <Link href="/note/produk?dari=ringkasan" className="underline">
                  Isi modal per kg di Harga Produk
                </Link>
              )}
            </div>
          )}

          {drill === "returns" && (
            <ReturnBreakdown
              heading={`Retur per pelanggan · ${view.label}`}
              rows={returnSummary}
              unit="kg"
              customerHref={(id) => `/note/pelanggan/${id}`}
              orderWord="pesanan"
            />
          )}

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
            <h2 className="text-ink text-base font-bold">Per jenis mi</h2>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm tabular-nums">
                <thead>
                  <tr className="text-ink-muted border-border border-b text-left text-xs">
                    <th className="px-4 py-2 font-medium">Jenis</th>
                    <th className="px-4 py-2 text-right font-medium">Kg</th>
                    <th className="px-4 py-2 text-right font-medium">Nilai</th>
                    <th className="px-4 py-2 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {MIE_JENIS_KEYS.map((key) => {
                    const t = view.byType[key];
                    return (
                      <tr key={key} className="border-border border-b">
                        <td className="text-ink px-4 py-3 font-semibold">{JENIS_LABEL[key]}</td>
                        <td className="text-ink px-4 py-3 text-right">{formatKg(t.kg)}</td>
                        <td className="text-ink px-4 py-3 text-right">{formatRupiah(t.amount)}</td>
                        <td className="text-ink px-4 py-3 text-right">
                          {t.noCost.count > 0 ? (
                            <Badge variant="warning">{key === "CUSTOM" ? "Tanpa modal" : "Modal belum diisi"}</Badge>
                          ) : t.kg > 0 ? (
                            formatRupiah(t.margin)
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="text-ink px-4 py-3 font-bold">Total</td>
                    <td className="text-ink px-4 py-3 text-right font-bold">{formatKg(view.kg)}</td>
                    <td className="text-ink px-4 py-3 text-right font-bold">{formatRupiah(view.omzet)}</td>
                    <td className="text-ink px-4 py-3 text-right font-bold">{formatRupiah(view.margin)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-ink text-base font-bold">Omzet per {unit.toLowerCase()}</h2>
              {safeRange.from !== safeRange.to && (
                <ReportGranularityToggle
                  value={granularity}
                  onChange={(next) => {
                    // An untouched range follows the view (so Bulanan doesn't
                    // open on one lone bar), but a range the owner picked
                    // themselves is kept — switching to Bulanan is exactly how
                    // you'd want to read a long custom range.
                    const untouched = isDefaultRange(range, granularity, today);
                    setGranularity(next);
                    if (untouched) setRange(defaultRangeFor(next, today));
                    setSelectedKey(null);
                  }}
                />
              )}
            </div>
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
              pesanan (bukan cuma yang belum lunas) dikurangi retur; saldo awal dan koreksi tidak dihitung sebagai
              omzet maupun pembayaran.
            </p>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <EntrySheet
            key={editing.point.id}
            entry={editing.point}
            customer={{ id: editing.point.customerId, name: editing.point.customerName }}
            initialAction={editing.action}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
