#!/usr/bin/env python3
"""
Panel D of the finalised Figure 2 draws what analysis/weight_sensitivity.json says.

Panel D is a 7 x 32 grid: one row per weight in the sweep, one column per target-edit
combination, each cell the RT-template length selected at that weight. Every one of those 224
numbers also lives in weight_sensitivity.json, and until this script was written on
29 September 2026 nothing compared the two. The figure was finalised by hand on 25 September
and the benchmark was rebuilt on 28 September, so the panel and its source had three days in
which to disagree, and they did: the heading still said 31 combinations after the rebuilt sweep
covered 32, and three deletion columns still carried their pre-rebuild lengths.

    OsCDC48-T1/DEL    panel 13 nt, sweep 12 nt
    OsCDC48-T2/DEL    panel 14 nt, sweep 13 nt
    SlDMR6/DEL        panel 15 nt, sweep 12 nt

The other 203 cells agreed, which is why nobody saw it.

READING THE GRID IS THE HARD PART, and getting it wrong is how this check first reported a
defect that was not there.

  * Three leftover cells sit at the very back of the z-order, off the column lattice and
    hidden behind the opaque cells drawn over them. They are invisible in the rendered figure.
    A first pass collected them, put two values in one cell, and reported TaUbi10-T2/SNS as a
    design that moves with the weight when it does not. Cells are therefore taken only where
    they sit on the lattice, and where two land in one place the LAST DRAWN wins, because that
    is the one the reader sees.
  * The rotated labels under the grid anchor to the left of their column and do not share the
    column's x, so they are paired to columns by rank, never by position. Pairing them by
    position is what put the labels one column out when the 32nd column was inserted.

    python3 analysis/check_figure2_panelD.py [--pptx Figures_Main_FINAL.pptx]

Exit status 1 if anything disagrees. It needs nothing beyond the deposit.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from lib.figure2_paneld import (leaves as leaves_, NCOL, ROW_Y, EDIT_CODE, KNOWN_LEFTOVERS,      # noqa: E402
                                read_grid, read_labels, sweep_columns)

ap = argparse.ArgumentParser()
ap.add_argument('--pptx', default=os.path.join(ROOT, 'Figures_Main_FINAL.pptx'))
ap.add_argument('--slide', type=int, default=2, help='1-based; Figure 2 is slide 2')
a = ap.parse_args()

if not os.path.exists(a.pptx):
    print('  this check reads the main figure deck, which is not part of the code deposit —')
    print('  the authors supply the published figures to the journal directly, and this')
    print('  archive holds the analyses that derive and check what the figures state.')
    print('  Pass a deck and it will run:')
    print('      python3 analysis/check_figure2_panelD.py --pptx path/to/deck.pptx')
    print('  nothing checked.')
    sys.exit(0)

from pptx import Presentation                                                # noqa: E402

OK, BAD = [], []


def ck(what, ok, got=''):
    (OK if ok else BAD).append((what, got))


SWEEP = json.load(open(os.path.join(HERE, 'weight_sensitivity.json'), encoding='utf8'))
PER = SWEEP['per_locus']
WEIGHTS = [str(w) for w in SWEEP['weights_tested']]
# The panel writes the edit type in the reader's abbreviations, the sweep in the caller's.
CODE = EDIT_CODE

prs = Presentation(a.pptx)
ck('the deck has slide %d' % a.slide, len(prs.slides) >= a.slide,
   '%d slides' % len(prs.slides))
if len(prs.slides) < a.slide:
    for w, g in BAD:
        print('  FAIL  %s  %s' % (w, g))
    sys.exit(1)
slide = prs.slides[a.slide - 1]

ck('the sweep covers %d target-edit combinations' % NCOL, len(PER) == NCOL,
   '%d in weight_sensitivity.json' % len(PER))
ck('the sweep tests %d weights' % len(ROW_Y), len(WEIGHTS) == len(ROW_Y),
   ', '.join(WEIGHTS))

# ── the grid ────────────────────────────────────────────────────────────────
cells, offlattice = read_grid(slide)
cell = {k: sh.text_frame.text.strip() for k, sh in cells.items()}

ck('every cell of the %d x %d grid was found' % (len(ROW_Y), NCOL),
   len(cell) == len(ROW_Y) * NCOL, '%d of %d' % (len(cell), len(ROW_Y) * NCOL))
# Three cells sit at the very back of the z-order, off the lattice, covered by the opaque
# cells drawn over them — invisible in the figure, and the reason this check takes the last
# drawn shape rather than the first. A fourth would mean something new is hiding there.
ck('nothing sits off the column lattice',
   offlattice == KNOWN_LEFTOVERS,
   'the grid is all there is' if offlattice == KNOWN_LEFTOVERS
   else '%d shapes off the lattice, expected %d' % (offlattice, KNOWN_LEFTOVERS))

wrong = []
for r, w in enumerate(WEIGHTS):
    for c, q in enumerate(PER):
        want = '%dnt' % q['lengths'][w]
        got = cell.get((r, c), 'MISSING')
        if got != want:
            wrong.append('%s/%s at weight %s: panel %s, sweep %s'
                         % (q['locus'], CODE[q['edit_type']], w, got, want))
ck('every cell draws the length the sweep selected', not wrong,
   '%d cells' % (len(ROW_Y) * NCOL) if not wrong
   else '%d disagree in %d columns' % (len(wrong), len({x.split(' at ')[0] for x in wrong})))
for x in wrong[:8]:
    BAD.append(('    ', x))

# ── the labels, paired to columns by rank ───────────────────────────────────
got_lab = [sh.text_frame.text.strip() for sh in read_labels(slide)]
ck('the grid carries %d rotated column labels' % NCOL, len(got_lab) == NCOL,
   '%d labels' % len(got_lab))
# The sweep disambiguates two same-named loci by study; the panel does not, and does not need
# to, so the comparison is on the part before the parenthesis.
want_lab = sweep_columns(PER)
mis = [(k + 1, g, w) for k, (g, w) in enumerate(zip(got_lab, want_lab)) if g != w]
ck('every label matches its column in the sweep', not mis,
   '%d labels in order' % len(got_lab) if not mis
   else '; '.join('column %d: panel %s, sweep %s' % m for m in mis[:4]))

# ── the heading, and the designs that move ──────────────────────────────────
heading = next((sh.text_frame.text.strip() for sh in leaves_(slide.shapes)
                if sh.has_text_frame and 'RT-template length' in sh.text_frame.text), '')
ck('the heading states %d target-edit combinations' % NCOL, str(NCOL) in heading,
   heading or 'no heading found')

shipped = WEIGHTS.index(str(SWEEP['shipped_weight']))
panel_movers = {want_lab[c] for c in range(NCOL)
                for r in range(len(ROW_Y)) if cell.get((r, c)) != cell.get((shipped, c))}
sweep_movers = {want_lab[c] for c, q in enumerate(PER) if len(set(q['lengths'].values())) > 1}
ck('the designs that move with the weight are the ones the sweep found',
   panel_movers == sweep_movers,
   '%d movers: %s' % (len(sweep_movers), ', '.join(sorted(sweep_movers)))
   if panel_movers == sweep_movers
   else 'panel %s, sweep %s' % (sorted(panel_movers), sorted(sweep_movers)))

for w, g in OK:
    print('  ok    %-64s %s' % (w[:64], g))
for w, g in BAD:
    print('  FAIL  %-64s %s' % (w[:64], g))
print('\n  %d ok, %d FAILED' % (len(OK), len(BAD)))
sys.exit(1 if BAD else 0)
