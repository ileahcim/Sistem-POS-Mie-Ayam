import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/pwa/app-icon-mark";

// See icon-192/route.tsx — same reasoning, the larger manifest size.
export function GET() {
  return new ImageResponse(<AppIconMark fontSize={256} />, { width: 512, height: 512 });
}
