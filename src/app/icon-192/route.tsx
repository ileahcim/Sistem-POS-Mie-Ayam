import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/pwa/app-icon-mark";

// Dedicated PNG endpoint for manifest.ts's icons array — Next's built-in
// icon.tsx convention only feeds the <head> favicon <link> tag, not the Web
// App Manifest, which needs real hosted URLs at the specific sizes Android
// expects for "Add to Home Screen" (192 and 512).
export function GET() {
  return new ImageResponse(<AppIconMark fontSize={96} />, { width: 192, height: 192 });
}
