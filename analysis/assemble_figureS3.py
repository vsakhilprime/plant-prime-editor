#!/usr/bin/env python3
"""
Assemble Supplementary Figure S3 from four interface screenshots, two across and two down.

Takes panelA.png .. panelD.png from FigureS3_capture_kit/, letters them, and writes a TIFF
and PNG. Panels are matched on width and never rescaled relative to one another, so interface
text is the same size in every panel.

LAYOUT. The four panels were previously stacked in one column, giving a 1955 x 3802 image at
aspect 0.51 — a tall ribbon that left most of a landscape slide empty and had to be reproduced
as a full-page portrait figure. Each screenshot is about 2.2 wide by 1 tall, so two across and
two down comes out near aspect 1.95, which fills a 13.33 x 7.5 in slide and prints as a normal
landscape figure.

THE TRADEOFF, because it is a real one. Two panels across means each screenshot occupies half
the linear width it had in the single column, so at a fixed page width its interface text is
half the physical size. That is why the output dpi below is derived from a target print width
rather than fixed at 300: the grid is written so that it is exactly PRINT_MM wide at the dpi
reported, which keeps it comfortably above the 300 dpi journals ask for at final size and
leaves the on-screen figure zoomable to the original capture resolution. If this figure is
ever required to be read at print size without magnification, the single column was the more
legible arrangement and `--stack` restores it.

    python3 analysis/assemble_figureS3.py [--dir FigureS3_capture_kit] [--dpi N] [--stack]
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

d = 'FigureS3_capture_kit'
PRINT_MM = 170.0                 # double-column width; dpi is derived from it
dpi = None
STACK = '--stack' in sys.argv
if '--dir' in sys.argv: d = sys.argv[sys.argv.index('--dir') + 1]
if '--dpi' in sys.argv: dpi = int(sys.argv[sys.argv.index('--dpi') + 1])
HERE = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(HERE, '..', '..')
d = d if os.path.isabs(d) else os.path.join(root, d)

panels = []
for letter in 'ABCD':
    p = os.path.join(d, 'panel%s.png' % letter)
    if not os.path.exists(p):
        print('missing %s — capture it first, see HOW_TO_CAPTURE.md' % os.path.basename(p))
        sys.exit(1)
    panels.append((letter, Image.open(p).convert('RGB')))

# Match on the smallest native width rather than the largest: panel D is 1919 px against
# 1568 px for the rest, and downscaling it preserves detail where upscaling three panels to
# meet it would invent it.
W = min(im.width for _, im in panels)
GAPX, GAPY, LABEL, MARGIN = 34, 30, 46, 18


def fit(im):
    return im if im.width == W else im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)


panels = [(l, fit(im)) for l, im in panels]

try:
    font = ImageFont.truetype('DejaVuSans-Bold.ttf', 34)
except Exception:
    font = ImageFont.load_default()

if STACK:
    cells = [[panels[0]], [panels[1]], [panels[2]], [panels[3]]]
else:
    cells = [[panels[0], panels[1]], [panels[2], panels[3]]]

# Row height is the tallest panel in that row; shorter panels sit top-aligned in their cell,
# which keeps the letters on one baseline across the row.
row_h = [max(im.height for _, im in row) for row in cells]
ncol = max(len(r) for r in cells)
out_w = ncol * W + (ncol - 1) * GAPX + 2 * MARGIN
out_h = sum(h + LABEL for h in row_h) + (len(cells) - 1) * GAPY + 2 * MARGIN

if dpi is None:
    dpi = round(out_w / (PRINT_MM / 25.4))

out = Image.new('RGB', (out_w, out_h), 'white')
draw = ImageDraw.Draw(out)

y = MARGIN
for row, rh in zip(cells, row_h):
    x = MARGIN
    for letter, im in row:
        draw.text((x, y + 4), letter, fill='black', font=font)
        out.paste(im, (x, y + LABEL))
        # hairline so a dark panel edge does not bleed into the page
        draw.rectangle([x, y + LABEL, x + im.width - 1, y + LABEL + im.height - 1],
                       outline=(200, 200, 200))
        x += W + GAPX
    y += LABEL + rh + GAPY

png = os.path.join(d, 'FigureS3_interface_walkthrough.png')
tif = os.path.join(d, 'FigureS3_interface_walkthrough.tif')
out.save(png, dpi=(dpi, dpi))
out.save(tif, dpi=(dpi, dpi), compression='tiff_lzw')
print('  layout      : %s' % ('single column' if STACK else '2 across x 2 down'))
print('  panel width : %d px (matched on the narrowest native capture)' % W)
print('  wrote %s  (%d x %d px, %d dpi = %.1f x %.1f mm)'
      % (os.path.basename(png), out.width, out.height, dpi,
         25.4 * out.width / dpi, 25.4 * out.height / dpi))
print('  wrote %s' % os.path.basename(tif))
