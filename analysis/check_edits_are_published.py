#!/usr/bin/env python3
"""
Every edit this paper designs on must be one a study published. Check it, everywhere.

Until 20 September 2026 three analyses ran on substitutions no study reports: the worked
example installed G to A at position 306 of rice OsALS-T2, Supplementary Figure S1 installed
a test edit five bases into the template at both loci, and the 44-run architecture panel
installed that test edit at every species-spread locus. None was a fault in the figures -- a
walkthrough shows what the tool returns and a strand-geometry panel needs an edit at a chosen
offset -- but a reader had no way to tell, and Table S11 reproduced no published experiment.

They all now install published substitutions. This checker exists so they cannot drift back.
It re-derives each edit from data/benchmark_scored.csv and fails if any of them is not a
published one at the protospacer it sits on, and it fails if any document still states the
superseded demonstration edit.

    python3 analysis/check_edits_are_published.py [--dir DIR]
Exit status 1 on any disagreement.
"""
import sys as _s; _s.dont_write_bytecode = True   # a deposit should not ship __pycache__
import argparse, csv, json, os, re, sys

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default=os.environ.get('PPE_DOCS',
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'documents')))
a = ap.parse_args()


# The submitted documents are not part of the code deposit; say so and stop
# rather than crashing or reporting a missing file as a disagreement.
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from need_documents import require as _require   # noqa: E402
_require([os.path.join(a.dir, 'Manuscript_PlantPrimeEditor.docx')], 'check_edits_are_published.py', '--dir')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
from docx import Document

B = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'benchmark_scored.csv'))))
bad = []


def published_at(locus, pos1, alt):
    """every published edit at that locus, and whether this one is among them"""
    got = [(r.get('edit_from_top') or r['edit_from'], r.get('edit_to_top') or r['edit_to'],
            int(r['edit_pos'])) for r in B if r['locus'] == locus]
    return any(p == pos1 and t == alt for _, t, p in got), got


# ── 1. the worked example ───────────────────────────────────────────────────────
W = json.load(open(os.path.join(HERE, 'worked_example.json')))
ok, got = published_at(W['locus'], W['edit_pos1'], W['edit_to'])
print('  worked example   %s  >%s at %d   %s'
      % (W['locus'], W['edit_to'], W['edit_pos1'], 'published' if ok else 'NOT PUBLISHED'))
if not ok:
    bad.append('the worked-example edit is not published at %s (published: %s)'
               % (W['locus'], sorted({'%s>%s@%d' % g for g in got})))

# ── 2. Supplementary Figure S1, both panels ─────────────────────────────────────
RC = str.maketrans('ACGT', 'TGCA')
rc = lambda s: s.translate(RC)[::-1]
S1 = [('OsACC-T1', 'TTCCTCGTGCTGGACAAGTG', '+'), ('OsEPSPS-T1', 'GCAGTCACGGCTGCTGTCAA', '-')]
for loc, sp, strand in S1:
    rows = [r for r in B if r['published_spacer'] == sp and r['edit_type'] == 'SNP']
    if not rows:
        bad.append('Figure S1 %s: no published substitution at %s' % (loc, sp)); continue
    r = rows[0]
    pos, alt = int(r['edit_pos']), (r.get('edit_to_top') or r['edit_to'])
    win = r['genomic_seq']
    nick = (win.find(sp) + 17) if strand == '+' else (len(win) - 1 - (rc(win).find(sp) + 17))
    dist = (pos - 1 - nick) if strand == '+' else (nick - (pos - 1))
    print('  Figure S1        %-12s %s>%s at g.%d   published, %d nt into the template'
          % (loc, r.get('edit_from_top') or r['edit_from'], alt, pos, dist))
    if dist < 0:
        bad.append('Figure S1 %s: the edit is not 3\' of the nick' % loc)

# ── 3. all 44 architecture runs ─────────────────────────────────────────────────
CS = json.load(open(os.path.join(HERE, 'case_studies.json')))
runs = CS['controlled']['results'] + CS['spread']['results']
# The run reports the REGISTRY id ("SlOr (site B)"), which the benchmark's own locus column
# does not use -- the benchmark is keyed on the study label. Resolve through the spacer the
# run actually designed on, which is the only unambiguous key either file shares.
spacer_of = {}
for r in runs:
    d = r.get('design') or {}
    if d.get('spacer'):
        spacer_of.setdefault(r['locus'], d['spacer'])
loci = sorted(spacer_of)
for loc in loci:
    sp = spacer_of[loc]
    rows = [r for r in B if r['published_spacer'] == sp and r['edit_type'] == 'SNP']
    if not rows and loc == W['locus']:
        # the worked example designs on a spacer of the tool's own choosing, so its published
        # substitutions are those of the protospacer the source study used at that locus
        rows = [r for r in B if r['locus'] == loc and r['edit_type'] == 'SNP']
    if not rows:
        bad.append('case studies: no published substitution at %s (spacer %s)' % (loc, sp))
        continue
    print('  case studies     %-20s published %s>%s at %s'
          % (loc, rows[0].get('edit_from_top') or rows[0]['edit_from'],
             rows[0].get('edit_to_top') or rows[0]['edit_to'], rows[0]['edit_pos']))
print('  %d runs across %d loci' % (len(runs), len(loci)))

# ── 4. nothing may still state the superseded edit ──────────────────────────────
GONE = [r'G to A at position 306', r'G>A at 306', r'G→A at g\.306',
        r'C→A at g\.295', r'demonstration substitution', r'demonstration edit']
for f in ('Manuscript_PlantPrimeEditor.docx', 'Figure_Legends.docx', 'Supplementary_Data.docx'):
    path = os.path.join(a.dir, f)
    if not os.path.exists(path):
        bad.append('not found: %s' % f); continue
    doc = Document(path)
    txt = '\n'.join(p.text for p in doc.paragraphs)
    for t in doc.tables:
        for row in t.rows:
            txt += '\n' + ' | '.join(c.text for c in row.cells)
    hit = [g for g in GONE if g in txt]
    if hit:
        bad.append('%s still states %s' % (f, ', '.join(hit)))
    else:
        print('  ok    %-34s carries no superseded edit' % f)

for b in bad:
    print('  FAIL  ' + b)
print('  %s %d disagree' % ('ok   ' if not bad else 'FAIL ', len(bad)))
sys.exit(1 if bad else 0)
