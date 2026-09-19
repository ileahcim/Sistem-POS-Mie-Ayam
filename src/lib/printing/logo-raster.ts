"use client";

// Turns the store's monochrome logo (public/assets/logo-ctr-mono.png — a
// 1-bit PNG generated once from the full-color artwork, see
// receipt-meta.tsx) into a 1-bit raster that escpos.ts embeds via GS v 0,
// so the printed receipt carries the same branding the screen preview
// shows. Rasterizing runs in the browser (canvas) because the printer
// clients are the only place the bytes are needed — the server never sees
// binary pixels, and MockPrinter just shows the on-screen <img> anyway.
//
// Threshold rule: a dot prints where the source pixel is both opaque and
// dark (luminance < 128). That holds for any PNG, but it's exactly right
// for this file since it was already hue-classified to black-on-transparent
// for a 1-bit thermal head.

import type { LogoRaster } from "./types";

const LOGO_SRC = "/assets/logo-ctr-mono.png";
const TARGET_WIDTH_DOTS = 240; // multiple of 8; ~30mm on the 576-dot head

let cachePromise: Promise<LogoRaster | null> | null = null;

export function getLogoRaster(): Promise<LogoRaster | null> {
  cachePromise ??= buildLogoRaster();
  return cachePromise;
}

async function buildLogoRaster(): Promise<LogoRaster | null> {
  try {
    const image = new Image();
    image.src = LOGO_SRC;
    await image.decode();

    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) return null;

    const widthDots = TARGET_WIDTH_DOTS;
    const heightDots = Math.max(1, Math.round((sourceHeight / sourceWidth) * widthDots));

    const canvas = document.createElement("canvas");
    canvas.width = widthDots;
    canvas.height = heightDots;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, widthDots, heightDots);

    const imageData = ctx.getImageData(0, 0, widthDots, heightDots);
    const bytesPerRow = widthDots / 8;
    const bytes = new Uint8Array(bytesPerRow * heightDots);
    const { data } = imageData;

    for (let y = 0; y < heightDots; y++) {
      for (let x = 0; x < widthDots; x++) {
        const i = (y * widthDots + x) * 4;
        const alpha = data[i + 3];
        const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (alpha > 128 && luminance < 128) {
          bytes[y * bytesPerRow + (x >> 3)] |= 1 << (x & 7);
        }
      }
    }

    return { widthDots, heightDots, bytes };
  } catch {
    // Logo load/draw failure is never fatal — print the text header alone.
    return null;
  }
}

// Attach the precomputed (once per session) raster to a print payload. Any
// real-data fields are untouched; if the logo can't be rasterized the field
// is simply left null and escpos.ts falls back to a text-only header.
export async function withLogo<T extends { logoRaster?: LogoRaster | null }>(
  data: T,
): Promise<T & { logoRaster: LogoRaster | null }> {
  const raster = await getLogoRaster();
  return { ...data, logoRaster: raster };
}