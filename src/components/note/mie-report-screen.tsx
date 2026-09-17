"use client";

import { useMemo, useState } from "react";
import type { MieReportPoint } from "@/lib/mie/get-mie-report";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { bucketMie, type MieGranularity } from "@/lib/mie/bucket-mie";
import { MIE_FIXED_PRODUCT_TYPES, MIE_PRODUCT_LABEL, type MieProductType } from "@/lib/mie/types";
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

const TYPE_ROWS: { type: MieProductType; label: string }[] = [
  ...MIE_FIXED_PRODUCT_TYPES.map((t) => ({ type: t, label: MIE_PRODUCT_LABEL[t] })),
  { type: "CUSTOM", label: "Custom" },
];

function formatKg(kg: number): string {
  return `${(Math.round(kg * 100) / 100).toLocaleString("id-ID")} kg`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card padded className="flex min-w-[9.5rem] flex-1 flex-col gap-1">
      <span className="text-ink-muted text-xs font-medium">{label}</span>
      <span className="text-ink text-xl font-bold tabular-nums">{value}</span>
    </Card>
  );
}

// Monitoring for the raw-noodle ledger only — its own data (get-mie-report),
// never mixed with the POS dashboard numbers. Only the generic BarChart
// drawing primitive is shared. Tap a period row to see its per-type
// breakdown; the newest period is selected by default.
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const buckets = useMemo(() => bucketMie(points, granularity, today), [points, granularity, today]);
  const selected = buckets.find((b) => b.key === selectedKey) ?? buckets[buckets.length - 1];
  const unit = OPTIONS.find((o) => o.value === granularity)!.unit;

  const rangeOmzet = buckets.reduce((s, b) => s + b.omzet, 0);
  const rangePayments = buckets.reduce((s, b) => s + b.payments, 0);

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
          <div className="rounded-pill bg-muted flex h-12 items-center self-start p-1" role="group" aria-label="Periode">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={granularity === opt.value}
                onClick={() => {
                  setGranularity(opt.value);
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

          <section className="flex flex-col gap-2">
            <h2 className="text-ink text-base font-bold">{selected.longLabel}</h2>
            <div className="flex flex-wrap gap-3">
              <Stat label="Omzet (pesanan)" value={formatRupiah(selected.omzet)} />
              <Stat label="Pembayaran diterima" value={formatRupiah(selected.payments)} />
              <Stat label="Mi terjual" value={formatKg(selected.kg)} />
            </div>
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
                      <td className="text-ink px-4 py-3 text-right">{formatKg(selected.byType[type].kg)}</td>
                      <td className="text-ink px-4 py-3 text-right">{formatRupiah(selected.byType[type].amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="text-ink px-4 py-3 font-bold">Total</td>
                    <td className="text-ink px-4 py-3 text-right font-bold">{formatKg(selected.kg)}</td>
                    <td className="text-ink px-4 py-3 text-right font-bold">{formatRupiah(selected.omzet)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-ink text-base font-bold">Omzet {buckets.length} {unit.toLowerCase()} terakhir</h2>
            <Card padded className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-ink-muted">
                  Omzet <span className="text-ink font-bold">{formatRupiah(rangeOmzet)}</span>
                </span>
                <span className="text-ink-muted">
                  Pembayaran <span className="text-ink font-bold">{formatRupiah(rangePayments)}</span>
                </span>
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
                      aria-selected={b.key === selected.key}
                      className={cn(
                        "border-border h-12 cursor-pointer border-b last:border-b-0",
                        b.key === selected.key && "bg-primary-soft",
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
              Ketuk baris untuk melihat rincian per jenis mi periode itu. Omzet dihitung dari semua pesanan (bukan
              cuma yang belum lunas); saldo awal dan koreksi tidak dihitung sebagai omzet maupun pembayaran.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
