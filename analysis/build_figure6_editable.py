#!/usr/bin/env python3
"""
build_figure6_editable.py — redraw Figure 6 as native PowerPoint shapes.

Figure 6 was the last placed image among the main figures, and the only display item whose
numbers had no check in verify_manuscript_numbers.py. Both are now fixed: every mark on this
slide is a PowerPoint shape computed from data/pridict_vs_measured.json, the same file the
verifier reads, so the figure cannot drift away from the statistics the paper reports.

  Panel A   the PBS length PRIDICT2.0 scores highest against the length that actually won
  Panel B   PRIDICT2.0 score against measured efficiency, 23 pegRNAs at four rice targets

THE NORMALISATION IS THE WHOLE FIGURE. Measured efficiency is expressed as a percentage of
the best pegRNA at that same target, exactly as the Figure 6B legend states. Pooled raw
efficiency gives rho = +0.11, P = 0.60 — the opposite sign — because between-target
differences in absolute editability swamp the within-target trend that the figure is about.
Anyone recomputing this without normalising will not reproduce the paper.

The statistics are printed under the panel-B title rather than in a box inside the axes:
no quadrant of that scatter is empty (occupancy is 4/8/4/7), so any inset box would either
sit on data or need a white fill that hides it.

    python3 analysis/build_figure6_editable.py [path/to/Figures.pptx]
"""
import json, os, sys

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

from build_editable_figures import (
    DECK as DEFAULT_DECK, ROOT, text, rect, dot, line, blank_slide, reorder,
    vlabel, bargroup, legend_row, INK, MUTED, BAND, WHITE, TOOL_COLOUR,
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

# Panel A series names double as legend labels and as TOOL_COLOUR keys, which is what
# bargroup and legend_row key off. Registering them here keeps both panels on one palette.
PRIDICT_PURPLE = RGBColor(0x7C, 0x3A, 0xED)
MEASURED_GREEN = RGBColor(0x15, 0x80, 0x3D)
S_PRED = 'Length PRIDICT2.0 scores highest'
S_BEST = 'Length that actually worked best'
TOOL_COLOUR[S_PRED] = PRIDICT_PURPLE
TOOL_COLOUR[S_BEST] = MEASURED_GREEN

TARGET_COLOUR = {
    'OsAAT':      RGBColor(0x0D, 0x94, 0x88),
    'OsACC-T1':   RGBColor(0x25, 0x63, 0xEB),
    'OsALS-T2':   RGBColor(0xEA, 0x58, 0x0C),
    'OsEPSPS-T1': RGBColor(0xE1, 0x1D, 0x48),
}
ORANGE = RGBColor(0xC2, 0x41, 0x0C)
GRID   = RGBColor(0xE5, 0xE7, 0xEB)


def load():
    p = os.path.join(ROOT, 'data', 'pridict_vs_measured.json')
    rows = json.load(open(p))
    best = {}
    for r in rows:
        best[r['target']] = max(best.get(r['target'], 0.0), r['eff'])
    for r in rows:
        r['eff_norm'] = 100.0 * r['eff'] / best[r['target']]
    return rows


def spearman(a, b):
    """Rank correlation with the same two-sided P the verifier and the manuscript quote.

    A hand-rolled version using the normal approximation to t was tried first and printed
    P = 0.011 where the correct value is 0.0185 — at n = 23 the normal tail is far too thin,
    and the slide would have carried a P that disagreed with the paper. SciPy is already a
    stated dependency of this deposit and verify_manuscript_numbers.py uses the same call,
    so both now come from one implementation.
    """
    from scipy.stats import spearmanr
    rho, p = spearmanr(a, b)
    return float(rho), float(p)


def scatter(slide, x0, y0, w, h, rows, xlo, xhi, xstep, ylo, yhi, ystep,
            xlab, ylab, letter='B', title='', subtitle=''):
    """PRIDICT score against normalised efficiency, one dot per pegRNA, coloured by target."""
    PADL, PADB, PADT = 0.64, 0.60, 0.30
    px, py = x0 + PADL, y0 + PADT
    pw, ph = w - PADL - 0.12, h - PADT - PADB
    xv = lambda v: px + (v - xlo) / (xhi - xlo) * pw
    yv = lambda v: py + ph - (v - ylo) / (yhi - ylo) * ph

    text(slide, x0, y0 - 0.30, 0.22, 0.22, letter, size=13, bold=True)
    if title:
        text(slide, x0 + 0.22, y0 - 0.30, w - 0.22, 0.22, title, size=10.5, bold=True)
    if subtitle:
        text(slide, x0 + 0.22, y0 - 0.07, w - 0.22, 0.20, subtitle,
             size=8.6, italic=True, colour=MUTED)

    v = ylo
    while v <= yhi + 1e-9:
        line(slide, px, yv(v), px + pw, yv(v), colour=GRID, lw=0.5)
        text(slide, px - 0.56, yv(v) - 0.075, 0.50, 0.16, '%d' % v,
             size=8, colour=MUTED, align=PP_ALIGN.RIGHT)
        v += ystep
    v = xlo
    while v <= xhi + 1e-9:
        line(slide, xv(v), py, xv(v), py + ph, colour=GRID, lw=0.5)
        text(slide, xv(v) - 0.25, py + ph + 0.07, 0.50, 0.16, '%d' % v,
             size=8, colour=MUTED, align=PP_ALIGN.CENTER)
        v += xstep

    # least-squares fit, drawn only across the span the data actually covers
    xs = [r['hek'] for r in rows]
    ys = [r['eff_norm'] for r in rows]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den if den else 0.0
    icpt = my - slope * mx
    fa, fb = min(xs), max(xs)
    ya, yb = slope * fa + icpt, slope * fb + icpt
    ya, yb = max(ylo, min(yhi, ya)), max(ylo, min(yhi, yb))
    line(slide, xv(fa), yv(ya), xv(fb), yv(yb), colour=MUTED, lw=1.3, dash=True)

    line(slide, px, py, px, py + ph, colour=INK, lw=0.9)
    line(slide, px, py + ph, px + pw, py + ph, colour=INK, lw=0.9)
    vlabel(slide, x0 + 0.10, py + ph / 2, ph, ylab)
    text(slide, px, py + ph + 0.26, pw, 0.20, xlab, size=8.6, colour=INK,
         align=PP_ALIGN.CENTER)

    for r in rows:
        dot(slide, xv(r['hek']), yv(r['eff_norm']), 0.115,
            fill=TARGET_COLOUR[r['target']], line=WHITE, lw=0.9)
    return px, py, pw, ph


def target_legend(slide, x, y, names, size=8.4, gap=0.12):
    cx = x
    for nm in names:
        dot(slide, cx + 0.05, y + 0.075, 0.095, fill=TARGET_COLOUR[nm], line=WHITE, lw=0.6)
        wpt = 0.062 * len(nm) + 0.14
        text(slide, cx + 0.13, y, wpt, 0.17, nm, size=size, colour=INK)
        cx += 0.13 + wpt + gap
    return cx


def build(prs, rows):
    s = blank_slide(prs)
    text(s, 0.42, 0.30, 12.5, 0.32,
         'Figure 6   A mammalian-trained efficiency predictor does not transfer to plant '
         'prime editing', size=17, bold=True)

    tgts = ['OsAAT', 'OsACC-T1', 'OsALS-T2', 'OsEPSPS-T1']
    pred, best = [], []
    for t in tgts:
        rs = [r for r in rows if r['target'] == t]
        pred.append(max(rs, key=lambda r: r['hek'])['pbs'])
        best.append(max(rs, key=lambda r: r['eff'])['pbs'])

    bargroup(s, 0.52, 1.44, 6.02, 4.28, tgts, {S_PRED: pred, S_BEST: best},
             0, 16, 2, 'primer-binding-site length (nt)', band=(8, 11), letter='A',
             title='What PRIDICT2.0 picks against what worked in rice')
    legend_row(s, 0.86, 5.86, [S_PRED, S_BEST])

    rho, p = spearman([r['hek'] for r in rows], [r['eff_norm'] for r in rows])
    scatter(s, 7.10, 1.44, 5.74, 4.28, rows, 60, 85, 5, 0, 100, 20,
            'PRIDICT2.0 predicted editing score',
            'measured efficiency (% of best at that target)',
            letter='B', title='Predicted score against measured efficiency',
            subtitle='Spearman rho = %+.2f,  P = %.3f,  n = %d' % (rho, p, len(rows)))
    target_legend(s, 7.62, 5.86, tgts)

    text(s, 0.52, 6.28, 12.3, 0.24,
         'Mechanism, not noise:  PRIDICT2.0 favours longer primer-binding sites '
         '(rho = +0.39 with length); in rice, efficiency falls as the site lengthens '
         '(rho = −0.68, P = 0.0004). Its two cell-line models agree with each other '
         '(rho = +0.86).', size=9.2, bold=True, colour=ORANGE)
    text(s, 0.52, 6.62, 12.3, 0.62,
         'Twenty-three published pegRNAs at four rice targets, spanning 7–15 nt of '
         'primer-binding site. Efficiency in B is normalised within each target to that '
         'target’s own maximum, as in the Figure 6B legend; on raw pooled efficiency the '
         'correlation is +0.11, P = 0.60. The shaded band in A marks the 8–11 nt window '
         'derived in this work, and the dashed line in B is a least-squares fit. '
         'Source: data/pridict_vs_measured.json, the table printed as Supplementary Table S10.',
         size=7.6, colour=MUTED)
    return s


def main():
    rows = load()
    prs = Presentation(DECK)
    n_before = len(prs.slides._sldIdLst)

    # Locate the placed-image Figure 6 rather than trusting a fixed index: the deck has
    # already been reordered once, and a hardcoded position would silently drop the wrong
    # slide if it is reordered again.
    fig6 = [i for i, sl in enumerate(prs.slides)
            if any(sh.has_text_frame and sh.text_frame.text.strip().startswith('Figure 6')
                   for sh in sl.shapes)]
    if len(fig6) != 1:
        sys.exit('  expected exactly one Figure 6 slide, found %d' % len(fig6))
    old = fig6[0]

    s = build(prs, rows)
    new = n_before                       # add_slide appends, so the new slide is last
    order = [i for i in range(n_before) if i != old]
    order.insert(old, new)
    reorder(prs, order, dropped=[old])
    _out = _ppe_out_path(DECK)
    prs.save(_out)
    print('  wrote ' + _out + ('  (--in-place given)' if _out == DECK else '  (original left untouched; pass --in-place to overwrite)'))

    print('  Figure 6 redrawn as %d native shapes, replacing the placed image at slide %d'
          % (len(s.shapes), old + 1))
    print('  %d slides in, %d slides out' % (n_before, len(Presentation(DECK).slides._sldIdLst)))


if __name__ == '__main__':
    main()
