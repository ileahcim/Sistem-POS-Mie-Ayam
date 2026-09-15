import type { MetadataRoute } from "next";

// No `orientation` lock on purpose: this same installed app is opened both
// from the warung's tablet in landscape (Kasir/Order Aktif — see CLAUDE.md
// "Kepadatan layar") AND from the owner's phone in portrait (Dashboard —
// see CLAUDE.md "Tes dua ukuran layar"). Locking orientation here would
// fight one of those two real use cases.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "POS Mi Ayam",
    short_name: "Mi Ayam",
    description: "Sistem kasir warung mi ayam",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f5f6",
    theme_color: "#0ea94b",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
