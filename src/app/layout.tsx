import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MockPrinterOverlay } from "@/components/printing/mock-printer-overlay";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { SheetMotionProvider } from "@/components/ui/sheet-motion";
import { getSheetBlurEnabled } from "@/lib/settings/get-settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cipta Rasa",
  description: "Sistem kasir warung Cipta Rasa",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cipta Rasa",
  },
};

// Matches manifest.ts's theme_color — colors the Android status bar/task
// switcher and (via appleWebApp above) iOS Safari's chrome when installed.
export const viewport: Viewport = {
  themeColor: "#0ea94b",
};

// Forces every route in the app to render per-request — set once here so
// no individual page can forget it. Found the hard way (Tahap 12): a page
// whose only data access is Prisma (getActiveMenu, getOpenShift, etc, with
// no cookies()/headers() call of its own) gives Next's static analysis
// nothing to detect as "dynamic" — Prisma isn't fetch(), so it's invisible
// to Next's caching heuristics — and several pages (Kasir, Piutang,
// Pesanan Terjadwal, Buka/Input Pengeluaran Shift) got silently
// build-time-frozen: `next build` marked them "○ Static", and a real
// production server (`next start`) kept serving the exact same first
// render — a live price change in the database never showed up on a hard
// reload until this was added. Confirmed fixed the same way: bumped a
// product's price directly in the DB against a running `next start`, and
// the very next request reflected it. Every page here needs fresh data on
// every request — there's no legitimately static page in this app — so
// this is the correct default for the whole tree, not a per-page opt-in.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sheetBlurEnabled = await getSheetBlurEnabled();
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SheetMotionProvider blurEnabled={sheetBlurEnabled}>
          {children}
          <MockPrinterOverlay />
        </SheetMotionProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
