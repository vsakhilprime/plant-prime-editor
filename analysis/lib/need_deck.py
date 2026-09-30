"""
One place to say "this script needs a figure deck, which the deposit does not hold".

The companion to lib/need_documents.py, and it exists for the same reason. Six scripts read a
PowerPoint deck: five builders and rebuilders, and analysis/check_figure2_panelD.py. Until
29 September 2026 the deposit shipped the two finalised decks, so those scripts always found
one and the not-found branch was never taken in a suite run. When the authors decided to supply
the figures to the journal directly rather than in the archive, that branch became the normal
case — and five of the six raised SystemExit with a MESSAGE but a non-zero STATUS:

    check_figure_overlaps.py     exits 1
    build_editable_figures.py    exits 1
    build_figure7_blocks.py      exits 1
    build_figure6_editable.py    exits 1
    place_figureS3_slide.py      exits 1

A reviewer running the suite against the published archive would have met five failures for a
file the archive is deliberately not meant to contain. The README had been promising the
opposite in plain words for weeks — "Each says so and exits cleanly if it is not given one" —
and nothing checked it. analysis/check_deposit_integrity.py now runs all six and requires
status 0, which is what found this.

They also named a deck that no longer exists anywhere, docs/Figures_PlantPrimeEditor.pptx,
left over from the layout before the finalised decks replaced the per-figure files.

Exit 0 is deliberate, for the same reason as need_documents: nothing was checked, so nothing
failed, and a non-zero status in a suite run marks the deposit bad for a file it was never
meant to carry.
"""
import os
import sys


def find_or_explain(script, argv=None, extra_candidates=()):
    """Return the deck path from argv[1] or a candidate, or explain and exit 0.

    `extra_candidates` lets a caller keep looking in a working tree of its own, so that
    rebuilding in place still works for the authors while the published archive stays clean.
    """
    argv = sys.argv if argv is None else argv
    if len(argv) > 1 and argv[1]:
        return argv[1]
    for cand in extra_candidates:
        if cand and os.path.exists(cand):
            return cand
    print('  this script reads a PowerPoint figure deck, which is not part of the code')
    print('  deposit — the authors supply the published figures to the journal directly, and')
    print('  this archive holds the analyses that derive and check what the figures state.')
    print('  Pass a deck as the first argument and it will run:')
    print('      python3 analysis/%s path/to/deck.pptx' % script)
    print('  nothing done.')
    sys.exit(0)
