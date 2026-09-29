#!/usr/bin/env python3
"""
Rebuild every figure from the shipped tool and say, per figure, whether anything moved.

Correcting the tool changes what the figure builders derive. Figures 2 and 3 were rebuilt
deliberately; the rest were ASSUMED unaffected, and an assumption is not a check — the whole
reason Figure 3 stated a design the tool no longer produced was that nobody re-derived it.

This runs every builder against the current build and compares the result with the deck
currently shipped: slide count, shape count per slide, and every text box, in order. A figure
that genuinely did not move comes back identical; one that moved is named, with the first few
differing strings, so the change can be read rather than guessed at.

    python3 analysis/rebuild_all_figures.py [--baseline DIR] [--keep]

ORDER MATTERS, and getting it wrong is silent. analysis/worked_example_run.js and
analysis/case_studies.js copy their build stamp out of figure3_editable_data.json, so they
must run AFTER the figure builders and BEFORE analysis/stamp_build_ids.py. Run them the
other way round and the Supplementary's worked-example section is labelled with the
previous build; stamp_build_ids.py will report the stamp as unaccounted for rather than
guessing, which is how this was caught on 27 September 2026:

    python3 analysis/rebuild_all_figures.py --keep
    node analysis/worked_example_run.js && node analysis/case_studies.js
    python3 analysis/stamp_build_ids.py

Exit status is non-zero if a rebuild fails. A figure that CHANGED is not a failure — it is a
result, and the rebuilt file is left in place for inspection.
"""
import argparse, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument('--baseline', default='.')
ap.add_argument('--keep', action='store_true', help='leave rebuilt files in the repository root')
a = ap.parse_args()

from pptx import Presentation

# builder -> the file it writes, relative to the repository root
FIGURES = [
    ('Figure 1',  ['node', 'analysis/build_figure1_editable.js'],  'Figure1_pipeline_editable.pptx'),
    ('Figure 2',  ['node', 'analysis/build_figure2_editable.js'],  'Figure2_ABCDEF_editable.pptx'),
    ('Figure 3',  ['node', 'analysis/build_figure3_editable.js'],  'Figure3_AB_editable.pptx'),
    ('Figure 4',  ['node', 'analysis/build_figure4_editable.js'],  'Figure4_ABC_editable.pptx'),
    ('Figure 5',  ['node', 'analysis/build_figure5_editable.js'],  'Figure5_editable.pptx'),
    ('Figure 6',  ['node', 'analysis/build_figure6_editable.js'],  'Figure6_AB_editable.pptx'),
    ('Figure S1', ['node', 'analysis/build_figureS1_editable.js'], 'FigureS1_editable.pptx'),
    ('Figure S4', ['node', 'analysis/build_figureS4_editable.js'], 'FigureS4_editable.pptx'),
]


def fingerprint(path):
    """Slide-by-slide shape count and every text box, in document order."""
    prs = Presentation(path)
    out = []
    for i, s in enumerate(prs.slides):
        texts = []
        for sh in s.shapes:
            if sh.has_text_frame:
                t = sh.text_frame.text
                if t.strip(): texts.append(t)
        out.append((i, len(s.shapes), texts))
    return out


def compare(old, new):
    """Return a list of human-readable differences."""
    diffs = []
    if len(old) != len(new):
        return ['slide count %d -> %d' % (len(old), len(new))]
    for (i, no, to), (_, nn, tn) in zip(old, new):
        if no != nn:
            diffs.append('slide %d: %d shapes -> %d' % (i + 1, no, nn))
        if len(to) != len(tn):
            diffs.append('slide %d: %d text boxes -> %d' % (i + 1, len(to), len(tn)))
        so, sn = set(to), set(tn)
        for t in sorted(so - sn)[:3]:
            diffs.append('slide %d  removed: %s' % (i + 1, t[:110].replace('\n', ' ')))
        for t in sorted(sn - so)[:3]:
            diffs.append('slide %d  added  : %s' % (i + 1, t[:110].replace('\n', ' ')))
    return diffs


print('Rebuilding every figure from the shipped build, and comparing with what is shipped.\n')
failed, moved, same, skipped = [], [], [], []
for name, cmd, out in FIGURES:
    base = os.path.join(a.baseline, out)
    if not os.path.exists(base):
        skipped.append('%s: no baseline at %s' % (name, out)); continue
    before = os.path.join(ROOT, out)
    stash = None
    if os.path.exists(before):
        stash = tempfile.mktemp(suffix='.pptx')
        shutil.copy(before, stash)
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0 or not os.path.exists(before):
        failed.append('%s: %s' % (name, (r.stderr or r.stdout).strip().splitlines()[-1:] or ['no output']))
        print('  %-10s BUILD FAILED' % name)
        if stash: shutil.copy(stash, before)
        continue
    try:
        d = compare(fingerprint(base), fingerprint(before))
    except Exception as e:
        failed.append('%s: %s' % (name, e)); print('  %-10s COMPARE FAILED  %s' % (name, e)); continue

    # the audit line the builder prints, so a layout regression shows here too
    audit = [l.strip() for l in r.stdout.splitlines()
             if 'layout audit' in l or 'no overlaps' in l or 'OVERFLOW' in l or 'COLLISION' in l]
    bad = [l for l in audit if 'OVERFLOW' in l or 'COLLISION' in l]

    if d:
        moved.append((name, d))
        print('  %-10s CHANGED  (%d difference(s))' % (name, len(d)))
        for x in d[:6]: print('        ' + x)
    else:
        same.append(name)
        print('  %-10s unchanged   %s' % (name, audit[-1] if audit else ''))
    if bad:
        print('        ! ' + '; '.join(bad[:2]))
        failed.append('%s: layout audit reported %s' % (name, bad[0]))
    if not a.keep and stash:
        shutil.copy(stash, before)

print('\n%d unchanged, %d changed, %d could not be built, %d skipped'
      % (len(same), len(moved), len(failed), len(skipped)))
for s in skipped: print('  skipped  ' + s)
for f in failed:  print('  FAILED   ' + str(f))
if moved:
    print('\nchanged: ' + ', '.join(n for n, _ in moved))
sys.exit(1 if failed else 0)
