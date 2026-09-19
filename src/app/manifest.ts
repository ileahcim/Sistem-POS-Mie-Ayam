import type { MetadataRoute } from "next";

// No `orientation` lock on purpose: this same installed app is opened both
// from the warung's tablet in landscape (Kasir/Order Aktif — see CLAUDE.md
// "Kepadatan layar") AND from the owner's phone in portrait (Dashboard —
// see CLAUDE.md "Tes dua ukuran layar"). Locking orientation here would
// fight one of those two real use cases.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cipta Rasa",
    short_name: "Cipta Rasa",
    description: "Sistem kasir warung Cipta Rasa",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Solid white, same as the icon's own background, so the Android splash
    // screen shows the icon without a visible square around it.
    background_color: "#ffffff",
    theme_color: "#0ea94b",
    // Static PNGs made by scripts/make-app-icons.py (colour CTR logo on a
    // solid white background — never transparent). The maskable one keeps the
    // logo inside the central safe zone so a circle/squircle crop never cuts it.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
