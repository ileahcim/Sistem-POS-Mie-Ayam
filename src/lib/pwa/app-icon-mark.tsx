// Shared visual mark used by every generated icon size (favicon, apple
// touch icon, and the two manifest PNG sizes) so they all stay in sync —
// plain text on a solid fill, well within Satori's (ImageResponse's
// renderer) supported CSS subset. Solid edge-to-edge fill also means this
// safely doubles as a "maskable" icon (Android can crop it to a circle/
// squircle without clipping into empty space) — see manifest.ts.
export function AppIconMark({ fontSize }: { fontSize: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0ea94b",
        color: "#ffffff",
        fontSize,
        fontWeight: 700,
        fontFamily: "sans-serif",
        letterSpacing: -1,
      }}
    >
      MA
    </div>
  );
}
