"use client";

// Precached by the service worker at install time (see public/sw.js) and
// served only when a fresh navigation fails with no network at all —
// deliberately static with zero data fetching, so it can never show a
// stale/misleading snapshot of orders, queue numbers, or cash figures (see
// CLAUDE.md "PWA" for why that distinction matters for a cash register).
//
// Inline styles on purpose, not the shared Card/Button/Tailwind classes:
// `cache.addAll(["/offline"])` only precaches this page's own HTML
// response, not whatever hashed CSS chunk it references — since that
// chunk's URL isn't knowable ahead of a build and may never have been
// separately fetched+cached, a normal Tailwind-styled version of this page
// would render as unstyled text the first time it's ever shown offline.
// This page has to be able to render its own styling with zero other
// cached assets, so it can't depend on anything outside itself.
export default function OfflinePage() {
  return (
    <div
      style={{
        background: "#f4f5f6",
        display: "flex",
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        minHeight: "100dvh",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          padding: 16,
          width: "100%",
          maxWidth: 384,
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#1a1a1a" }}>
          Tidak Ada Koneksi
        </h1>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#6b7280" }}>
          Tablet ini sedang tidak tersambung internet. Sambungkan lagi lalu coba muat ulang.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            width: "100%",
            height: 56,
            borderRadius: 999,
            border: "none",
            background: "#0ea94b",
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
