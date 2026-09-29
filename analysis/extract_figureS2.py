#!/usr/bin/env python3
"""
Give Supplementary Figure S2 a file of its own.

Every other display item has a standalone editable deck that a builder writes and
analysis/rebuild_all_figures.py re-derives. Figure S2, the pegRNA-architecture bar figure,
never did: it exists only as two slides inside Figures_master_carry_source.pptx, which the
master-deck assembler pulls from by title. Nothing was wrong with the figure, but a journal
asking for each supplementary figure as its own file could not be given one, and the gap was
invisible while S2 sat in the middle of a deck.

This lifts those two slides into FigureS2_architectures_editable.pptx, with the same page size
and without disturbing the carry source. It is an extraction, not a redraw: the slides are
copied element for element, so the file is the figure the paper already shows.

    python3 analysis/extract_figureS2.py [--dir DIR]
"""
import argparse, copy, os, re, sys

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default='.')
ap.add_argument('--title', default='Figure S2')
ap.add_argument('--out', default='FigureS2_architectures_editable.pptx')
ap.add_argument('--src', default=None,
                help='deck to lift the slides from. Defaults to Figures_master_carry_source.pptx; '
                     'the submission deck carries the same slides and can be used when the '
                     'carry source is not to hand.')
a = ap.parse_args()

from pptx import Presentation

SRC = a.src or os.path.join(a.dir, 'Figures_master_carry_source.pptx')
if not os.path.isabs(SRC): SRC = os.path.join(a.dir, SRC)
if not os.path.exists(SRC):
    print('  FAIL carry source not found: %s' % SRC)
    sys.exit(1)

src = Presentation(SRC)
keep = [s for s in src.slides
        if ' '.join(sh.text_frame.text for sh in s.shapes if sh.has_text_frame)
        .strip().startswith(a.title)]
if not keep:
    print('  FAIL no slide in the carry source starts with %r' % a.title)
    sys.exit(1)

out = Presentation()
out.slide_width, out.slide_height = src.slide_width, src.slide_height
layout = min(out.slide_master.slide_layouts,
             key=lambda l: len(l.placeholders._element.getchildren()))

for s in keep:
    new = out.slides.add_slide(layout)
    for shape in list(new.shapes):
        shape._element.getparent().remove(shape._element)
    for el in s.shapes._spTree:
        if el.tag.endswith('}nvGrpSpPr') or el.tag.endswith('}grpSpPr'):
            continue
        new.shapes._spTree.append(copy.deepcopy(el))

dst = os.path.join(a.dir, a.out)
out.save(dst)

chk = Presentation(dst)
n = len(chk.slides._sldIdLst)
empty = [i for i, s in enumerate(chk.slides, 1)
         if not any(sh.has_text_frame and sh.text_frame.text.strip() for sh in s.shapes)]
ok = n == len(keep) and not empty
print('  %s %s: %d slide(s), %.3f x %.3f in%s'
      % ('ok  ' if ok else 'FAIL', a.out, n,
         out.slide_width / 914400, out.slide_height / 914400,
         '' if ok else '   ! empty slides %s' % empty))
sys.exit(0 if ok else 1)
