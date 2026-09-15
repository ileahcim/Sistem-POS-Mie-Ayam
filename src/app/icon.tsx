import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/pwa/app-icon-mark";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<AppIconMark fontSize={16} />, size);
}
