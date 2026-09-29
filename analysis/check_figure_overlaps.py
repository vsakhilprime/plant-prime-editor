#!/usr/bin/env python3
"""
check_figure_overlaps.py — find colliding labels in the figure deck.

Text sitting on top of other text is the failure mode that survives every other check: the
file opens, the shapes are all there, and the figure is unreadable. This walks every slide
and reports any pair of text boxes whose bounding rectangles intersect by more than a
tolerance, plus any shape that runs off the slide.

Rotated boxes are compared on their rotated footprint, since a 270° axis title occupies a
tall narrow strip rather than the wide flat one its unrotated geometry implies.

    python3 analysis/check_figure_overlaps.py [path/to/Figures.pptx]

Exit status is non-zero if anything collides, so it can gate a rebuild.
"""
import os, sys

from pptx import Presentation
from pptx.util import Emu

HERE = os.path.dirname(os.path.abspath(__file__))
def _find_deck(here):
    """Locate the figure deck, preferring a path given on the command line.

    This previously pointed only at ../../SUBMISSION_v1.0/02_figures/, which exists in the
    authors' working tree and nowhere else. Anyone running this from an unpacked deposit got
    PackageNotFoundError with no indication of what was missing. The deck now ships in
    docs/, so the deposit is self-contained; the working-tree path is still tried first so
    that rebuilding in place still updates the submission copy.
    """
    import sys
    if len(sys.argv) > 1:
        return sys.argv[1]
    for cand in (os.path.join(here, '..', '..', 'SUBMISSION_v1.0', '02_figures',
                              'Figures_PlantPrimeEditor.pptx'),
                 os.path.join(here, '..', 'docs', 'Figures_PlantPrimeEditor.pptx')):
        if os.path.exists(cand):
            return cand
    sys.path.insert(0, os.path.join(here, 'lib'))
    sys.path.insert(0, here)
    from lib.need_deck import find_or_explain
    return find_or_explain('check_figure_overlaps.py', extra_candidates=())


DECK = _find_deck(HERE)

TOL_IN   = 0.012      # ignore hairline touching
MIN_AREA = 0.0016     # ignore slivers, in square inches
EMU      = 914400.0


def box(sh):
    """Axis-aligned footprint in inches, accounting for 90/270 rotation."""
    x, y = sh.left / EMU, sh.top / EMU
    w, h = (sh.width or 0) / EMU, (sh.height or 0) / EMU
    rot = (sh.rotation or 0) % 360
    if 45 < rot < 135 or 225 < rot < 315:
        cx, cy = x + w / 2, y + h / 2
        w, h = h, w
        x, y = cx - w / 2, cy - h / 2
    return x, y, w, h


# Arial advance width averages about 0.50 em across mixed-case text; digits and capitals
# run wider, lower case narrower. 0.52 is a slight over-estimate, which is the safe
# direction for a collision check.
EM_W, LINE_H = 0.52, 1.22


def ink_box(sh):
    """The rectangle the text actually paints, not the box it is allowed to use.

    Comparing declared boxes flagged 113 collisions on a deck that renders cleanly: the
    boxes are deliberately generous so text can be retyped without reflowing. Estimating
    the drawn extent from the string length, point size and paragraph alignment gives a
    signal that tracks what a reader sees.
    """
    x, y, w, h = box(sh)
    tf = sh.text_frame
    lines = [p for p in tf.paragraphs if (p.text or '').strip()]
    if not lines:
        return None
    widest, total = 0.0, 0.0
    align = None
    for p in lines:
        size = None
        for r in p.runs:
            if r.font.size:
                size = r.font.size.pt; break
        size = size or 10.0
        widest = max(widest, len(p.text) * size * EM_W / 72.0)
        total += size * LINE_H / 72.0
        align = align or p.alignment
    widest = min(widest, w)
    total = min(total, h)
    a = str(align)
    if 'CENTER' in a:
        x = x + (w - widest) / 2
    elif 'RIGHT' in a:
        x = x + (w - widest)
    return x, y, widest, total


def texts(slide):
    out = []
    for sh in slide.shapes:
        if not sh.has_text_frame:
            continue
        s = (sh.text_frame.text or '').strip()
        if s:
            b = ink_box(sh)
            if b:
                out.append((sh, s, b))
    return out


def overlap(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = min(ax + aw, bx + bw) - max(ax, bx) - TOL_IN
    iy = min(ay + ah, by + bh) - max(ay, by) - TOL_IN
    return (ix * iy) if (ix > 0 and iy > 0) else 0.0


def main():
    prs = Presentation(DECK)
    W, H = prs.slide_width / EMU, prs.slide_height / EMU
    problems = 0

    for n, slide in enumerate(prs.slides, 1):
        title = ''
        for sh in slide.shapes:
            if sh.has_text_frame and sh.text_frame.text.strip():
                title = sh.text_frame.text.strip().split('\n')[0][:46]
                break
        items = texts(slide)
        hits = []
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                area = overlap(a[2], b[2])
                if area > MIN_AREA:
                    hits.append((area, a[1][:34], b[1][:34]))
        off = []
        for sh in slide.shapes:
            b = ink_box(sh) if sh.has_text_frame and sh.text_frame.text.strip() else box(sh)
            x, y, w, h = b
            if x < -0.02 or y < -0.02 or x + w > W + 0.02 or y + h > H + 0.02:
                lbl = (sh.text_frame.text.strip()[:34]
                       if sh.has_text_frame and sh.text_frame.text.strip() else sh.shape_type)
                off.append(str(lbl))

        flag = 'ok' if not hits and not off else '%d overlap, %d off-slide' % (len(hits), len(off))
        print('  slide %-3d %-48s %s' % (n, title, flag))
        for area, s1, s2 in sorted(hits, reverse=True)[:6]:
            print('        %.3f in²  %r  vs  %r' % (area, s1, s2))
        for o in off[:4]:
            print('        off-slide: %s' % o)
        problems += len(hits) + len(off)

    print('\n  %s' % ('no collisions and nothing off-slide' if not problems
                      else '%d problem(s) found' % problems))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
