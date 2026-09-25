import { cn } from "@/components/ui/cn";

// Same hand-rolled SVG approach as TrendLineChart (fixed-height, scaling
// width, preserveAspectRatio="none" so it never looks squashed on a narrow
// phone with many bars) — but unlike that chart, this one has text labels
// ("15 Sep", "Mingguan 3", ...). Text glyphs stretch along with everything
// else under non-uniform "none" scaling, so when there are few bars the SVG
// gets stretched much wider than its natural viewBox and the labels come
// out visibly squashed/stretched horizontally. Fix: labels are NOT drawn
// inside the SVG at all — they're a separate HTML row below it, laid out
// with plain flexbox percentages, which the browser always renders at
// their natural glyph shape regardless of how wide that row ends up.
//
// Optional select mode (Dashboard Omzet, 26 Sep 2026): pass `onSelect` and
// each bar gets a transparent full-height tap target over its slot — never
// narrower than 48px (the chart scrolls sideways instead) — and the selected
// bar is drawn darker while the rest fade. Without `onSelect` the chart
// renders exactly as before.
export function BarChart({
  bars,
  selectedIndex = null,
  onSelect,
  describe,
}: {
  bars: { label: string; value: number }[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  // Accessible name of a bar's tap target (e.g. "25 Sep: Rp1.200.000").
  describe?: (bar: { label: string; value: number }) => string;
}) {
  if (bars.length === 0) {
    return <p className="text-ink-faint py-8 text-center text-sm">Belum ada data.</p>;
  }

  const barWidth = 28;
  const gap = 10;
  const slot = barWidth + gap;
  const width = Math.max(bars.length * slot, 120);
  const height = 116;

  const max = Math.max(...bars.map((b) => b.value), 1);
  const slotPercent = (100 / bars.length).toFixed(4);
  const MIN_TAP = 48;
  const minWidth = onSelect ? Math.max(bars.length * MIN_TAP, bars.length > 10 ? width : 0) : bars.length > 10 ? width : 0;
  const hasSelection = selectedIndex != null;

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative" style={{ minWidth: minWidth ? `${minWidth}px` : undefined }}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-28 w-full">
          {bars.map((b, i) => {
            const barH = max > 0 ? (b.value / max) * (height - 8) : 0;
            const x = i * slot + gap / 2;
            const y = height - barH;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 1)}
                rx={3}
                className={cn(
                  i === selectedIndex ? "fill-primary-strong" : "fill-primary",
                  hasSelection && i !== selectedIndex && "opacity-35",
                )}
              />
            );
          })}
        </svg>
        <div className="flex">
          {bars.map((b, i) => (
            <div
              key={i}
              style={{ width: `${slotPercent}%` }}
              className={cn(
                "truncate px-0.5 text-center text-[10px]",
                i === selectedIndex ? "text-ink font-bold" : "text-ink-muted",
              )}
              title={b.label}
            >
              {b.label}
            </div>
          ))}
        </div>
        {onSelect && (
          <div className="absolute inset-0 flex" role="group" aria-label="Pilih batang">
            {bars.map((b, i) => (
              <button
                key={i}
                type="button"
                style={{ width: `${slotPercent}%` }}
                aria-pressed={i === selectedIndex}
                aria-label={describe ? describe(b) : b.label}
                onClick={() => onSelect(i)}
                className="h-full"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
