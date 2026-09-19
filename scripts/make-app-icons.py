#!/usr/bin/env python3
"""Builds the app icons (PWA manifest sizes, apple-touch-icon, favicon) from the
colour artwork reference/logo HD.png.

The icon is the colour bowl + red "CTR" on a SOLID white background — never
transparent, so it looks right on any Android launcher. The hairline arc text
("CIPTA RASA") and "GROUP" are left out on purpose: unreadable at icon sizes, and
a round launcher mask would clip them. (The monochrome print logo is a different
asset: scripts/make-thermal-logo.py.)

Outputs
  public/icons/icon-192.png            manifest, purpose "any"
  public/icons/icon-512.png            manifest, purpose "any"
  public/icons/icon-maskable-512.png   manifest, purpose "maskable": logo kept inside
                                       the central safe zone so a circle/squircle
                                       crop never cuts into it
  src/app/apple-icon.png               180x180 iOS home screen (Next file convention)
  src/app/icon.png                     64x64 favicon (Next file convention)

Run from the repo root:  python3 scripts/make-app-icons.py
Needs: Pillow, numpy, scipy.
"""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC = "reference/logo HD.png"
BACKGROUND = (255, 255, 255)

img = Image.open(SRC).convert("RGBA")
flat = Image.new("RGBA", img.size, (255, 255, 255, 255))
flat.alpha_composite(img)
rgb = np.asarray(flat.convert("RGB"))

r, g, b = (rgb[..., i].astype(int) for i in range(3))
dark = (r < 90) & (g < 90) & (b < 90)
labels, count = ndi.label(dark)
sizes = ndi.sum(dark, labels, range(1, count + 1))
outline = np.isin(labels, [i + 1 for i, s in enumerate(sizes) if s > 2000])  # bowl outline + foot

# Everything the outline encloses (yellow fill, red CTR) plus the outline itself;
# anything outside — the arc text and GROUP — turns paper white.
bowl = ndi.binary_fill_holes(outline) | outline
disc = np.hypot(*np.ogrid[-4:5, -4:5]) <= 4
keep = ndi.binary_dilation(bowl, disc)  # small halo keeps the anti-aliased edge colours
coloured = np.where(keep[..., None], rgb, 255).astype(np.uint8)

ys, xs = np.where(bowl)
pad = 6
logo = Image.fromarray(
    coloured[max(ys.min() - pad, 0) : ys.max() + pad + 1, max(xs.min() - pad, 0) : xs.max() + pad + 1]
)


def icon(size: int, logo_width_fraction: float) -> Image.Image:
    canvas = Image.new("RGB", (size, size), BACKGROUND)
    w = round(size * logo_width_fraction)
    h = round(logo.height * w / logo.width)
    canvas.paste(logo.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return canvas


# Maskable safe zone = a circle of ~80% of the icon; a 3:2 logo fits inside it
# when its width is at most ~62% of the icon.
outputs = [
    ("public/icons/icon-192.png", 192, 0.80),
    ("public/icons/icon-512.png", 512, 0.80),
    ("public/icons/icon-maskable-512.png", 512, 0.62),
    ("src/app/apple-icon.png", 180, 0.80),
    ("src/app/icon.png", 64, 0.90),
]
import os

os.makedirs("public/icons", exist_ok=True)
for path, size, fraction in outputs:
    icon(size, fraction).save(path, optimize=True)
    print(f"{path}: {size}x{size}")
