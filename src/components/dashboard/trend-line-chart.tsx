// Plain hand-rolled SVG — no charting library. viewBox width scales with
// point count, height is fixed via the wrapper's CSS class regardless of
// container width (preserveAspectRatio="none" maps the box directly), so
// the chart never looks "gepeng" (squashed) on a narrow phone screen — see
// CLAUDE.md "Dashboard" viewport requirements. No text lives inside this
// SVG, so the non-uniform "none" scaling only ever stretches the line/dots
// (barely visible), never distorts a label — see BarChart for the chart
// that does have labels and needs a different approach for that reason.
export function TrendLineChart({
  points,
  minPointsMessage = "Butuh minimal 2 titik data untuk menampilkan tren.",
}: {
  points: { label: string; value: number }[];
  minPointsMessage?: string;
}) {
  if (points.length === 0) {
    return <p className="text-ink-faint py-8 text-center text-sm">Belum ada data.</p>;
  }
  // A line needs two points to draw anything — one point alone would just
  // render as a single dot ("gumpalan hijau"), which reads as broken rather
  // than "not enough data yet". Say that plainly instead.
  if (points.length === 1) {
    return <p className="text-ink-faint py-8 text-center text-sm">{minPointsMessage}</p>;
  }

  const width = Math.max(points.length * 28, 120);
  const height = 120;
  const padY = 12;

  const maxAbs = Math.max(...points.map((p) => Math.abs(p.value)), 1);
  const zeroY = height / 2;
  const scale = (height / 2 - padY) / maxAbs;

  const coords = points.map((p, i) => ({
    x: points.length === 1 ? width / 2 : (i / (points.length - 1)) * width,
    y: zeroY - p.value * scale,
    value: p.value,
    label: p.label,
  }));

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        style={{ minWidth: points.length > 20 ? `${width}px` : undefined }}
      >
        <line x1={0} y1={zeroY} x2={width} y2={zeroY} className="stroke-border" strokeWidth={1} />
        <path d={path} fill="none" className="stroke-primary" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={2.5}
            className={c.value < 0 ? "fill-danger" : "fill-primary"}
          />
        ))}
      </svg>
    </div>
  );
}
