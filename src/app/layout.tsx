import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MockPrinterOverlay } from "@/components/printing/mock-printer-overlay";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
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
  title: "POS Mi Ayam",
  description: "Sistem kasir warung mi ayam",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mi Ayam",
  },
};

// Matches manifest.ts's theme_color — colors the Android status bar/task
// switcher and (via appleWebApp above) iOS Safari's chrome when installed.
export const viewport: Viewport = {
  themeColor: "#0ea94b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <MockPrinterOverlay />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
