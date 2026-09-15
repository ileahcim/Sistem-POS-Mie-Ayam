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
export function BarChart({ bars }: { bars: { label: string; value: number }[] }) {
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

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: bars.length > 10 ? `${width}px` : undefined }}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-28 w-full">
          {bars.map((b, i) => {
            const barH = max > 0 ? (b.value / max) * (height - 8) : 0;
            const x = i * slot + gap / 2;
            const y = height - barH;
            return (
              <rect key={i} x={x} y={y} width={barWidth} height={Math.max(barH, 1)} rx={3} className="fill-primary" />
            );
          })}
        </svg>
        <div className="flex">
          {bars.map((b, i) => (
            <div
              key={i}
              style={{ width: `${slotPercent}%` }}
              className="text-ink-muted truncate px-0.5 text-center text-[10px]"
              title={b.label}
            >
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
