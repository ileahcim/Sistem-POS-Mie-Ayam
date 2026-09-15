// Same hand-rolled SVG approach as TrendLineChart — see that file's comment
// for why a fixed-height/scaling-width viewBox keeps this from ever looking
// squashed on a narrow phone screen.
export function BarChart({ bars }: { bars: { label: string; value: number }[] }) {
  if (bars.length === 0) {
    return <p className="text-ink-faint py-8 text-center text-sm">Belum ada data.</p>;
  }

  const barWidth = 28;
  const gap = 10;
  const width = Math.max(bars.length * (barWidth + gap), 120);
  const height = 140;
  const labelH = 20;
  const chartH = height - labelH;

  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-36 w-full"
        style={{ minWidth: bars.length > 10 ? `${width}px` : undefined }}
      >
        {bars.map((b, i) => {
          const barH = max > 0 ? (b.value / max) * (chartH - 8) : 0;
          const x = i * (barWidth + gap) + gap / 2;
          const y = chartH - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={Math.max(barH, 1)} rx={3} className="fill-primary" />
              <text
                x={x + barWidth / 2}
                y={height - 4}
                textAnchor="middle"
                className="fill-ink-muted"
                style={{ fontSize: 9 }}
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
