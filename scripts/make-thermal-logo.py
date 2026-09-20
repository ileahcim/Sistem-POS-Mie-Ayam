#!/usr/bin/env python3
"""Builds public/assets/logo-ctr-thermal.png from reference/logo HD.png.

Why a separate thermal logo: the full artwork has hairline-thin curved lettering
("CIPTA RASA" over the bowl, "GROUP" under it) that does not survive a 203 DPI
1-bit thermal head — it printed as blotches. The thermal version keeps only what
is bold enough to print: the bowl outline + foot and the "CTR" letters, all made
thicker. The lettering is dropped entirely — the receipt says the warung name in
printer text right underneath (from Setting), so repeating "CIPTA RASA GROUP" in
the logo block was redundant.

Colour classification (not grayscale): the artwork is red/yellow/black, and a plain
grayscale threshold would turn red and yellow into indistinguishable mid-grays.
  - black  -> bowl outline + foot: kept, thickened
  - red    -> kept ONLY inside the bowl (the CTR letters); red outside the bowl
              (the arc text and GROUP) is dropped
  - yellow -> the bowl fill: becomes paper white

Run from the repo root:  python3 scripts/make-thermal-logo.py
Needs: Pillow, numpy, scipy.
"""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC = "reference/logo HD.png"
OUT = "public/assets/logo-ctr-thermal.png"
# Dots wide, multiple of 8 (GS v 0 packs 8 dots per byte). 224 dots ≈ 28 mm at
# 203 DPI: big enough to read, small enough to look like a logo instead of a
# banner — 416 (≈52 mm) ate nearly the whole printable width. It also cuts the
# raster from ~14 KB to ~4 KB, i.e. from 29 BLE frames to 9, which matters
# because a dropped frame shows up as a horizontally shifted row in the bowl.
TARGET_W = 224
OUTLINE_GROW = 5  # px at source resolution (outline is ~12 px there): thicker lines
LETTER_GROW = 3
MARGIN = 14
THRESHOLD = 150  # luma below this prints black; a bit above 128 keeps strokes bold

img = Image.open(SRC).convert("RGBA")
flat = Image.new("RGBA", img.size, (255, 255, 255, 255))
flat.alpha_composite(img)
rgb = np.asarray(flat.convert("RGB")).astype(int)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

dark = (r < 90) & (g < 90) & (b < 90)
red = (r > 140) & (g < 90) & (b < 90)

# Keep only the big dark components (bowl outline, foot); tiny specks are noise.
labels, count = ndi.label(dark)
sizes = ndi.sum(dark, labels, range(1, count + 1))
dark_keep = np.isin(labels, [i + 1 for i, s in enumerate(sizes) if s > 2000])

# Everything enclosed by the outline = the bowl body. Red inside it is the CTR.
interior = ndi.binary_fill_holes(dark_keep) & ~dark_keep
ctr = red & interior

disc = lambda n: np.hypot(*np.ogrid[-n : n + 1, -n : n + 1]) <= n
black = ndi.binary_dilation(dark_keep, disc(OUTLINE_GROW)) | ndi.binary_dilation(ctr, disc(LETTER_GROW))

ys, xs = np.where(black)
y0, y1 = max(ys.min() - MARGIN, 0), min(ys.max() + MARGIN + 1, black.shape[0])
x0, x1 = max(xs.min() - MARGIN, 0), min(xs.max() + MARGIN + 1, black.shape[1])
black = black[y0:y1, x0:x1]

tall = round(black.shape[0] * TARGET_W / black.shape[1])
gray = Image.fromarray(np.where(black, 0, 255).astype(np.uint8)).resize((TARGET_W, tall), Image.LANCZOS)
bw = np.asarray(gray) >= THRESHOLD  # True = paper white
Image.fromarray(bw).convert("1").save(OUT, optimize=True)
print(f"{OUT}: {TARGET_W}x{tall} dots, {TARGET_W // 8} bytes/row")
