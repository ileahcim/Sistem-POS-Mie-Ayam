"use client";

import { cn } from "@/components/ui/cn";

// Harian/Mingguan/Bulanan on Ringkasan Mi Mentah and Frozen. It only groups
// the chart and the "Rincian per …" table under it — WHICH days are counted
// is the date-range card at the top. So it sits beside the chart heading,
// like Dashboard's Omzet, not in the filter card where it read as a second,
// competing filter (26 Sep 2026).
export type ReportGranularity = "harian" | "mingguan" | "bulanan";

export const GRANULARITY_OPTIONS: { value: ReportGranularity; label: string; unit: string }[] = [
  { value: "harian", label: "Harian", unit: "Hari" },
  { value: "mingguan", label: "Mingguan", unit: "Minggu" },
  { value: "bulanan", label: "Bulanan", unit: "Bulan" },
];

// A one-day range has nothing to group, so the choice is hidden and the
// screen reads per day — whatever was picked before comes back with a
// longer range.
export function effectiveGranularity(g: ReportGranularity, from: string, to: string): ReportGranularity {
  return from === to ? "harian" : g;
}

export function ReportGranularityToggle({
  value,
  onChange,
}: {
  value: ReportGranularity;
  onChange: (next: ReportGranularity) => void;
}) {
  return (
    <div className="rounded-pill bg-muted flex h-12 items-center p-1" role="group" aria-label="Kelompokkan per">
      {GRANULARITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-pill h-10 px-4 text-sm font-semibold",
            value === opt.value ? "bg-surface text-ink shadow-card" : "text-ink-muted",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
