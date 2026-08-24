#!/usr/bin/env python3
"""
build_figure5D_blocks.py — redraw Figure 5 panel D as a block matrix with tick and cross marks.

The panel previously used filled and open circles. A reader had to consult the key to learn
which ring meant absent, and at print size an open circle and a faint filled one are easy to
confuse. Blocks carrying an explicit mark say it without the key:

    solid green + tick      the tool does this
    amber + arrow           the tool hands this off to an external service
    pale grey + cross       the tool does not do this

The mark, not just the colour, carries the meaning, so the panel survives greyscale printing
and the common forms of colour blindness. Green and amber are the Okabe-Ito pair already used
across this deck rather than a red/green pairing, which is the one to avoid.

Two things are fixed while rebuilding. The matrix occupied 9.6 in of a 12.3 in panel, so the
columns are widened; and feature labels were being truncated at 58 characters with an ellipsis
when the longest is 62, which the wider label column now shows in full.

    python3 analysis/build_figure5D_blocks.py [path/to/Figures.pptx]
"""
import json, os, sys

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from build_editable_figures import (
    DECK as DEFAULT_DECK, ROOT, IN, text, rect, line, blank_slide, reorder,
    INK, MUTED, WHITE, TOOL_COLOUR,
)

# ── never overwrite the user's deck without being told to (added 23 Aug 2026) ──
# These scripts used to call prs.save(DECK) on the path given as argv[1], silently
# replacing a 3 MB binary the deposit does not ship and cannot restore. Confirmed
# destructive by md5 before and after a single run. The default is now to write a
# sibling file; --in-place restores the old behaviour for anyone who wants it.
def _ppe_out_path(deck_path):
    import os as _o, sys as _s
    if '--in-place' in _s.argv:
        return deck_path
    root, ext = _o.path.splitext(deck_path)
    return root + '_edited' + ext

DECK = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DECK

GREEN     = TOOL_COLOUR['Plant Prime Editor']      # 15803D
AMBER     = RGBColor(0xE6, 0x9F, 0x00)             # Okabe-Ito orange
ABSENT_BG = RGBColor(0xF1, 0xF3, 0xF5)
ABSENT_FG = RGBColor(0xAD, 0xB5, 0xBD)
NUM_BG    = RGBColor(0xE9, 0xEE, 0xF5)
BAND      = RGBColor(0xFA, 0xFB, 0xFC)
OWN_BG    = RGBColor(0xEC, 0xFD, 0xF3)
PURPLE    = TOOL_COLOUR['PRIDICT']

TICK, CROSS, ARROW = '✔', '✕', '→'

GROUPS = [('Entry point and annotation', 0, 4), ('Architecture coverage', 4, 10),
          ('Thermodynamics and promoter rules', 10, 13), ('Vector and cloning output', 13, 21),
          ('Prediction and off-target', 21, 23), ('Reproducibility and privacy', 23, 29)]


def rrect(slide, x, y, w, h, fill):
    """Rounded block. The default adjustment is proportional to the short side, which at this
    row height rounds the corners almost to a pill; 0.28 keeps them legibly square."""
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,
                                IN(x), IN(y), IN(w), IN(h))
    sh.adjustments[0] = 0.28
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    sh.line.fill.background()
    sh.shadow.inherit = False
    return sh


def block(slide, cx, cy, bw, bh, fill, glyph='', gcolour=WHITE, gsize=7.4, bold=True):
    """One matrix cell: a filled block with an optional mark centred in it."""
    rrect(slide, cx - bw / 2, cy - bh / 2, bw, bh, fill)
    if glyph:
        t = text(slide, cx - bw / 2, cy - bh / 2, bw, bh, glyph, size=gsize, bold=bold,
                 colour=gcolour, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        t.text_frame.word_wrap = False
    return


def panel_D(slide, x0, y0, w, h, feats):
    hdr, body = feats[0], feats[1:]
    tools = hdr[1:]

    text(slide, x0, y0 - 0.34, 0.24, 0.26, 'D', size=13, bold=True)
    text(slide, x0 + 0.24, y0 - 0.34, w - 0.24, 0.26,
         'Capability comparison across seven pegRNA design tools, 29 features',
         size=11.5, bold=True)

    LAB, COLW, RH = 4.15, 1.14, 0.1445
    BW, BH = 0.62, RH - 0.031
    gx = x0 + LAB
    grid_w = len(tools) * COLW
    rows_total = len(body) + len(GROUPS)
    gy = y0 + 0.62

    # own column tinted for its whole height, with a green cap above the header
    rect(slide, gx, y0 - 0.02, COLW, rows_total * RH + 0.72, fill=OWN_BG, line=None)
    rect(slide, gx, y0 - 0.02, COLW, 0.035, fill=GREEN, line=None)

    for j, t in enumerate(tools):
        cx = gx + j * COLW
        own = (j == 0)
        text(slide, cx + 0.02, y0 + 0.10, COLW - 0.04,
             0.46, {'Plant Prime Editor': 'Plant Prime\nEditor'}.get(t, t),
             size=7.6, bold=own, colour=GREEN if own else INK, align=PP_ALIGN.CENTER)
    line(slide, x0, gy - 0.08, gx + grid_w, gy - 0.08, colour=INK, lw=1.0)

    y = gy
    shade = False
    for gname, a, b in GROUPS:
        text(slide, x0 + 0.04, y + 0.012, LAB - 0.10, 0.17, gname.upper(),
             size=6.9, bold=True, colour=PURPLE)
        y += RH
        for r in body[a:b]:
            if shade:
                rect(slide, x0, y, LAB, RH, fill=BAND, line=None)
            shade = not shade
            text(slide, x0 + 0.16, y + 0.010, LAB - 0.24, 0.18, r[0], size=7.5, colour=INK)

            for j, v in enumerate(r[1:]):
                cx, cy = gx + j * COLW + COLW / 2, y + RH / 2
                v = (v or '').strip()
                if v == 'Yes':
                    block(slide, cx, cy, BW, BH, GREEN, TICK)
                elif v == 'No':
                    block(slide, cx, cy, BW, BH, ABSENT_BG, CROSS, ABSENT_FG, 6.8)
                elif v.startswith('Yes ('):
                    n = v[v.find('(') + 1:v.find(')')]
                    block(slide, cx, cy, BW, BH, GREEN, '%s  %s' % (TICK, n), WHITE, 6.6)
                elif v.startswith('No ('):
                    block(slide, cx, cy, BW, BH, AMBER, ARROW, WHITE, 7.8)
                elif v in ('—', ''):
                    block(slide, cx, cy, BW, BH, ABSENT_BG, '—', ABSENT_FG, 7.0, bold=False)
                else:
                    block(slide, cx, cy, BW, BH, NUM_BG, v, INK, 6.9, bold=False)
            y += RH
    line(slide, x0, y + 0.02, gx + grid_w, y + 0.02, colour=INK, lw=1.0)

    # ── tally ───────────────────────────────────────────────────────────────
    tally = [sum(1 for r in body if str(r[1 + j]).strip().startswith('Yes'))
             for j in range(len(tools))]
    text(slide, x0 + 0.16, y + 0.10, LAB - 0.24, 0.22, 'Features present, of 29',
         size=8.0, bold=True, colour=INK)
    for j, c in enumerate(tally):
        cx = gx + j * COLW + COLW / 2
        if j == 0:
            block(slide, cx, y + 0.205, BW, 0.20, GREEN, str(c), WHITE, 10.0)
        else:
            text(slide, cx - COLW / 2, y + 0.10, COLW, 0.22, str(c),
                 size=9.6, colour=INK, align=PP_ALIGN.CENTER)

    # ── key ─────────────────────────────────────────────────────────────────
    ly = y + 0.46
    cx = x0 + 0.16
    for fill, glyph, gcol, gsz, lab in [
            (GREEN, TICK, WHITE, 7.4, 'the tool does this'),
            (AMBER, ARROW, WHITE, 7.8, 'delegated to an external tool'),
            (ABSENT_BG, CROSS, ABSENT_FG, 6.8, 'the tool does not do this')]:
        block(slide, cx + 0.17, ly + 0.075, 0.34, 0.135, fill, glyph, gcol, gsz)
        wlab = 0.056 * len(lab) + 0.14
        text(slide, cx + 0.38, ly, wlab, 0.19, lab, size=7.8, colour=INK)
        cx += 0.38 + wlab + 0.26
    text(slide, cx, ly, x0 + w - cx, 0.19,
         'Feature set assessed 14 August 2026 on the versions in Table 1.',
         size=7.6, italic=True, colour=MUTED)


def main():
    feats = json.load(open(os.path.join(ROOT, 'data', 'feature_matrix.json')))
    prs = Presentation(DECK)
    n_before = len(prs.slides._sldIdLst)

    hits = [i for i, sl in enumerate(prs.slides)
            if any(sh.has_text_frame and sh.text_frame.text.strip().startswith('Figure 5')
                   and 'panel D' in sh.text_frame.text for sh in sl.shapes)]
    if len(hits) != 1:
        sys.exit('  expected exactly one Figure 5 panel D slide, found %d' % len(hits))
    old = hits[0]

    s = blank_slide(prs)
    text(s, 0.42, 0.30, 12.5, 0.32,
         'Figure 5   Comparison with existing pegRNA design tools (panel D)',
         size=17, bold=True)
    panel_D(s, 0.52, 1.06, 12.3, 5.9, feats)

    order = [i for i in range(n_before) if i != old]
    order.insert(old, n_before)
    reorder(prs, order, dropped=[old])
    _out = _ppe_out_path(DECK)
    prs.save(_out)
    print('  wrote ' + _out + ('  (--in-place given)' if _out == DECK else '  (original left untouched; pass --in-place to overwrite)'))
    print('  Figure 5 panel D redrawn as %d native shapes at slide %d' % (len(s.shapes), old + 1))
    print('  %d slides in, %d slides out'
          % (n_before, len(Presentation(DECK).slides._sldIdLst)))


if __name__ == '__main__':
    main()
