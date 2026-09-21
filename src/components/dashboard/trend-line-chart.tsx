import { formatRupiah } from "@/lib/printing/format";
import { cn } from "@/components/ui/cn";

// Plain hand-rolled SVG — no charting library. Fixed height, any width
// (preserveAspectRatio="none"), so it never looks squashed on a narrow phone
// — see CLAUDE.md "Dashboard" viewport requirements. Only the LINE lives in
// the stretched SVG; dots and labels are HTML so they keep their shape.
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

  // Plotted in a 0..100 box. The SVG stretches to the container (any width,
  // fixed height); the line keeps a 2px stroke through that stretch
  // (vector-effect), and the dots are HTML circles positioned in percent,
  // so they stay round. They used to be SVG circles, and at tablet width a
  // handful of points turned them into wide flat ovals and the line into a
  // thick smear — the "gepeng" chart.
  const padX = 2; // % — keeps the first/last dot off the card edge
  const padY = 10;
  const maxAbs = Math.max(...points.map((p) => Math.abs(p.value)), 1);
  const coords = points.map((p, i) => ({
    x: padX + (i / (points.length - 1)) * (100 - 2 * padX),
    y: 50 - (p.value / maxAbs) * (50 - padY),
    value: p.value,
    label: p.label,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
  const maxValue = Math.max(...points.map((p) => p.value));
  const minValue = Math.min(...points.map((p) => p.value));

  return (
    <div className="w-full overflow-x-auto">
      {/* Past 20 points it scrolls sideways rather than cramming the dots. */}
      <div style={{ minWidth: points.length > 20 ? `${points.length * 28}px` : undefined }}>
        <div className="relative h-32 w-full">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <line x1={0} y1={50} x2={100} y2={50} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <path d={path} fill="none" className="stroke-primary" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
          {coords.map((c, i) => (
            <span
              key={i}
              title={`${c.label}: ${c.value}`}
              className={cn(
                "absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                c.value < 0 ? "bg-danger" : "bg-primary",
              )}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
            />
          ))}
          <span className="text-ink-faint absolute top-1/2 left-0 -translate-y-full pb-0.5 text-[10px]">0</span>
        </div>
        <div className="text-ink-faint mt-1 flex justify-between text-xs">
          <span>{points[0].label}</span>
          <span className="tabular-nums">
            terendah {formatRupiah(minValue)} · tertinggi {formatRupiah(maxValue)}
          </span>
          <span>{points[points.length - 1].label}</span>
        </div>
      </div>
    </div>
  );
}
