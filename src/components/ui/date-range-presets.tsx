"use client";

import { DATE_RANGE_PRESETS, activePresetKey, type DateRange } from "@/lib/date-range/presets";
import { cn } from "./cn";

// The quick-range chips shared by Riwayat Pesanan and Ringkasan Mi Mentah.
// Only the buttons — each screen keeps its own "Dari"/"Sampai" inputs,
// because one applies on submit (URL-driven) and the other filters live.
// `today` comes from the server (Asia/Jakarta), never the device clock.
export function DateRangePresets({
  today,
  value,
  onPick,
  className,
}: {
  today: string;
  value: DateRange;
  onPick: (range: DateRange) => void;
  className?: string;
}) {
  const active = activePresetKey(value, today);
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label="Pilih cepat rentang tanggal">
      {DATE_RANGE_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          aria-pressed={active === preset.key}
          onClick={() => onPick(preset.range(today))}
          className={cn(
            "rounded-pill border-border h-12 border px-4 text-sm font-semibold",
            active === preset.key ? "bg-primary border-primary text-white" : "bg-surface text-ink",
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
