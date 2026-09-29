#!/usr/bin/env python3
"""
The two master decks — Figures_PlantPrimeEditor.pptx and the SUBMISSION copy — are built by
hand out of the per-figure files, and nothing rebuilt them when a per-figure file changed.
By 13 September 2026 both carried a two-slide Figure 2 that had since become six panels on
three slides, and a Figure 3 stating a 14 nt reverse-transcriptase template that the
corrected builder no longer produces. Opening the master deck therefore gave a reader a
different figure from the one the per-figure file and the legend describe.

This assembles both decks from the per-figure files, so there is one way to build them.

Slides for which no per-figure file exists — Figure S2 and the Figure S3 walkthrough
capture, which is a PNG placed on a slide, and the "How to use this file" sheet — are
carried across from the existing master deck rather than invented here.

    python3 analysis/assemble_master_deck.py [--dir DIR]

Every slide is copied with its relationships, so embedded images travel with it. The result
is checked: slide count, slide size, and that no slide came through empty.
"""
import argparse, copy, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default='.')
ap.add_argument('--submission-only', action='store_true',
                help='build only the SUBMISSION deck. The submission copy carries no "How to '
                     'use this file" sheet, so a carry source that is itself a submission deck '
                     'cannot supply one; without this flag the run would stop asking for it.')
ap.add_argument('--carry', default=None,
                help='pristine deck to take Figure S2, the S3 capture and the how-to sheet from; '
                     'must NOT be a deck this script writes')
a = ap.parse_args()
D = a.dir
CARRY = a.carry or os.path.join(D, 'Figures_master_carry_source.pptx')
if not os.path.exists(CARRY):
    raise SystemExit('carry source not found: %s\n'
                     'It holds the slides with no per-figure builder (Figure S2, the Figure S3\n'
                     'walkthrough capture, the how-to sheet). Keep one pristine copy and pass it\n'
                     'with --carry; never point this at a deck this script overwrites.' % CARRY)

from pptx import Presentation
from pptx.util import Emu

# FIX CARRY-OVER-BY-INDEX (13 September 2026). The slides with no per-figure file — Figure S2,
# the Figure S3 walkthrough capture, and the "How to use this file" sheet — were carried across
# from the existing master deck BY SLIDE INDEX, and the existing master deck is the file this
# script overwrites. The first run was correct. Every run after it read the deck the previous
# run had written, where Figure 2 had grown from two slides to three and Figure S5's four slides
# had been appended, so index 11 was no longer the walkthrough. The deck silently lost the one
# slide carrying an image and gained a duplicate architecture slide in its place.
#
# Carried-over slides are matched by their TITLE now, and read from a PRISTINE source that this
# script never writes. Pass --carry to point at it; the default is the archived original.
CARRY_TITLES = {
    'S2':    'Figure S2',
    'S3':    'Figure S3',
    'howto': 'How to use this file',
}


def find_by_title(prs, prefix):
    """Every slide whose first non-empty text box starts with this prefix, in order."""
    out = []
    for i, s in enumerate(prs.slides):
        for sh in s.shapes:
            if sh.has_text_frame and sh.text_frame.text.strip():
                if sh.text_frame.text.strip().startswith(prefix): out.append(i)
                break
    return out


# (source file, carry key or None) — a carry key means "from the pristine carry deck, by title"
PLAN = [
    ('Figure1_pipeline_editable.pptx',        None),
    ('Figure2_ABCDEF_editable.pptx',          None),
    ('Figure3_AB_editable.pptx',              None),
    ('Figure4_ABC_editable.pptx',             None),
    ('Figure5_editable.pptx',                 None),
    ('Figure6_AB_editable.pptx',              None),
    ('FigureS1_editable.pptx',                None),
    (None,                                    'S2'),
    (None,                                    'S3'),
    ('FigureS4_editable.pptx',                None),
]
# Supplementary Figure S5, the four-panel mechanism drawing of the eleven architectures,
# was withdrawn on 14 September 2026. The display items are Figures 1-6 and S1-S4. S5 had
# been APPENDED rather than inserted, so removing it renumbers nothing.
HOWTO = (None, 'howto')       # the "How to use this file" sheet — not in the submission copy


def blank_layout(prs):
    """The emptiest layout the template offers, so nothing is stamped under a copied slide."""
    layouts = prs.slide_master.slide_layouts
    return min(layouts, key=lambda l: len(l.placeholders._element.getchildren())
               if hasattr(l, 'placeholders') else 99)


def copy_slide(src_slide, dst_prs):
    """Deep-copy one slide's shape tree and clone every part it points at."""
    layout = blank_layout(dst_prs)
    new = dst_prs.slides.add_slide(layout)

    # remove whatever the layout put on the new slide
    for shape in list(new.shapes):
        shape._element.getparent().remove(shape._element)

    # bring the source shape tree across
    for el in src_slide.shapes._spTree:
        if el.tag.endswith('}nvGrpSpPr') or el.tag.endswith('}grpSpPr'):
            continue
        new.shapes._spTree.append(copy.deepcopy(el))

    # Clone the parts the slide refers to and rewrite the r:embed ids.
    #
    # Only content parts. The first attempt at this cloned EVERY relationship, including the
    # slide's own slideLayout and notesSlide — which dragged a foreign layout into the package
    # and gave two slides the same notesSlide partname. The zip then carried duplicate entries
    # (ppt/slides/slide4.xml twice) and neither deck would open. The destination slide has its
    # own layout, and the notes are carried over through the API below.
    CONTENT = ('/image', '/chart', '/media', '/video', '/audio', '/oleObject',
               '/diagramData', '/diagramLayout', '/diagramQuickStyle', '/diagramColors',
               '/package', '/tags', '/hyperlink')
    for rid, rel in src_slide.part.rels.items():
        if not any(rel.reltype.endswith(k) for k in CONTENT):
            continue
        if rel.is_external:
            new.part.rels.get_or_add_ext_rel(rel.reltype, rel.target_ref)
        else:
            new_rid = new.part.relate_to(rel.target_part, rel.reltype)
            if new_rid != rid:
                for attr in ('embed', 'link', 'id'):
                    q = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}' + attr
                    for el in new.shapes._spTree.iter():
                        if el.get(q) == rid:
                            el.set(q, new_rid)

    # the speaker notes, where there are any
    if src_slide.has_notes_slide and src_slide.notes_slide.notes_text_frame.text.strip():
        new.notes_slide.notes_text_frame.text = src_slide.notes_slide.notes_text_frame.text
    return new


def build(out_path, plan):
    # start from a copy of a per-figure file so the slide size and theme are the generated one,
    # then drop its own slides
    seed = Presentation(os.path.join(D, 'Figure1_pipeline_editable.pptx'))
    W, H = seed.slide_width, seed.slide_height
    dst = Presentation()
    dst.slide_width, dst.slide_height = W, H
    for i in range(len(dst.slides._sldIdLst) - 1, -1, -1):
        rid = dst.slides._sldIdLst[i].rId
        dst.part.drop_rel(rid)
        del dst.slides._sldIdLst[i]

    old = Presentation(CARRY)
    n = 0
    for src, key in plan:
        if src is None:
            idxs = find_by_title(old, CARRY_TITLES[key])
            if not idxs:
                raise SystemExit('no slide titled %r in %s — pass --carry at a deck that has one'
                                 % (CARRY_TITLES[key], CARRY))
            for i in idxs:
                copy_slide(old.slides[i], dst); n += 1
        else:
            p = Presentation(os.path.join(D, src))
            if (p.slide_width, p.slide_height) != (W, H):
                print('  ! %s has a different slide size' % src)
            for s in p.slides:
                copy_slide(s, dst); n += 1
    dst.save(out_path)
    return n


def audit(path, want):
    prs = Presentation(path)
    got = len(prs.slides)
    # The slide COUNT is not enough. When the carried slides were selected by index out of the
    # deck this script overwrites, the rebuilt deck still had 19 slides — it had simply lost the
    # Figure S3 walkthrough and gained a duplicate architecture slide in its place. So check what
    # is actually there: each carried title present exactly as often as in the carry source, and
    # the walkthrough still carrying its image.
    carry = Presentation(CARRY)
    for key, title in CARRY_TITLES.items():
        if key == 'howto' and 'SUBMISSION' in os.path.basename(path): continue
        want_n = len(find_by_title(carry, title))
        got_n  = len(find_by_title(prs, title))
        if got_n != want_n:
            print('  %-46s ! %r appears %d time(s), expected %d'
                  % (os.path.basename(path), title, got_n, want_n))
            return False
    pics = sum(1 for s in prs.slides for sh in s.shapes
               if sh.shape_type is not None and 'PICTURE' in str(sh.shape_type))
    want_pics = sum(1 for s in carry.slides for sh in s.shapes
                    if sh.shape_type is not None and 'PICTURE' in str(sh.shape_type)
                    and any(sh2.has_text_frame and sh2.text_frame.text.strip().startswith('Figure S3')
                            for sh2 in s.shapes))
    if pics < want_pics:
        print('  %-46s ! %d embedded image(s), expected at least %d — a placed capture was lost'
              % (os.path.basename(path), pics, want_pics))
        return False
    empty = [i for i, s in enumerate(prs.slides)
             if not ''.join(sh.text_frame.text for sh in s.shapes if sh.has_text_frame).strip()
             and not any(sh.shape_type is not None and 'PICTURE' in str(sh.shape_type) for sh in s.shapes)]
    ok = (got == want and not empty)
    print('  %-46s %2d slides, %s x %s%s'
          % (os.path.basename(path), got,
             round(prs.slide_width / 914400, 3), round(prs.slide_height / 914400, 3),
             '' if ok else '   ! %s' % ('slide count %d vs %d' % (got, want) if got != want
                                        else 'empty slides %s' % empty)))
    return ok


print('assembling the master deck%s from the per-figure files'
      % ('' if a.submission_only else 's'))
BUILDS = []
if not a.submission_only:
    BUILDS.append(('Figures_PlantPrimeEditor.pptx', PLAN + [HOWTO]))
BUILDS.append(('Figures_PlantPrimeEditor_SUBMISSION.pptx', PLAN))

ok, counts = True, {}
for base, plan in BUILDS:
    counts[base] = build(os.path.join(D, base + '.new'), plan)
for base, _ in BUILDS:
    ok &= audit(os.path.join(D, base + '.new'), counts[base])

if ok:
    for base, _ in BUILDS:
        os.replace(os.path.join(D, base + '.new'), os.path.join(D, base))
    print('\n%s rebuilt' % ('the submission deck' if a.submission_only else 'both decks'))
else:
    print('\nnot replacing the deck(s) — the audit did not pass; .new files left for inspection')
    sys.exit(1)
