"use client";

// Turns the thermal logo (public/assets/logo-ctr-thermal.png) into a 1-bit
// raster that escpos.ts embeds via GS v 0, so the printed receipt carries the
// same branding the screen preview shows. The PNG is already dot-exact: a
// 1-bit image made by scripts/make-thermal-logo.py (bowl outline + "CTR" only,
// thick strokes, 416 dots wide) — the hairline lettering of the full artwork
// is printed as plain text instead (see receipt-layout.ts). Rasterizing runs
// in the browser (canvas) because the printer clients are the only place the
// bytes are needed — the server never sees binary pixels, and MockPrinter just
// shows the on-screen <img> anyway.
//
// Threshold rule: a dot prints where the source pixel is both opaque and
// dark (luminance < 128). The image is drawn at its NATIVE size, never
// scaled: resampling a 1-bit image is exactly what turned thin strokes into
// blotches before.

import type { LogoRaster } from "./types";
import { RECEIPT_LOGO_SRC } from "./receipt-layout";

let cachePromise: Promise<LogoRaster | null> | null = null;

export function getLogoRaster(): Promise<LogoRaster | null> {
  cachePromise ??= buildLogoRaster();
  return cachePromise;
}

async function buildLogoRaster(): Promise<LogoRaster | null> {
  try {
    const image = new Image();
    image.src = RECEIPT_LOGO_SRC;
    await image.decode();

    const widthDots = image.naturalWidth;
    const heightDots = image.naturalHeight;
    // GS v 0 packs 8 horizontal dots per byte, so the width must be a
    // multiple of 8 (the generator script guarantees it).
    if (!widthDots || !heightDots || widthDots % 8 !== 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = widthDots;
    canvas.height = heightDots;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);

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
    // Logo load/draw failure is never fatal — print without the image.
    return null;
  }
}

// Attach the precomputed (once per session) raster to a print payload. Any
// real-data fields are untouched; if the logo can't be rasterized — or the
// owner switched it off with the "Cetak logo di struk" setting — the field
// is simply left null and escpos.ts falls back to a text-only header.
export async function withLogo<T extends { logoRaster?: LogoRaster | null; printLogo?: boolean }>(
  data: T,
): Promise<T & { logoRaster: LogoRaster | null }> {
  if (data.printLogo === false) return { ...data, logoRaster: null };
  const raster = await getLogoRaster();
  return { ...data, logoRaster: raster };
}