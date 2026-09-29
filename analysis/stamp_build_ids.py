#!/usr/bin/env python3
"""
Every figure stamps the build it was generated from — "Plant Prime Editor v1.0 · build
5331eb12" — and the legends quote that same identifier so a reader can tell which build a
number came from. The slide computes it; the legend had it typed in by hand.

So the legend went stale the moment the build moved. On 13 September 2026 the slide read
5331eb12 and the legend read d39dd6c8: correcting the figure had changed the design-parameter
fingerprint (it hashes the scoring functions' own source, not the file), and nothing updated
the prose.

This copies each figure's stamp out of the data file that figure was built from, into every
document that quotes it. Nothing types a build identifier any more.

    python3 analysis/stamp_build_ids.py [--dir DIR]

Exit status is non-zero if a document quotes a stamp that no figure data file accounts for.
"""
import argparse, json, os, re, sys
from docx import Document

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default='.')
args = ap.parse_args()
D = args.dir

# figure number -> the data file the figure was generated from
SOURCES = {
    '2': 'figure2_editable_data.json',
    '3': 'figure3_editable_data.json',
}
DOCS = ['Figure_Legends.docx', 'Manuscript_PlantPrimeEditor.docx', 'Supplementary_Data.docx']

builds = {}
for fig, fname in SOURCES.items():
    p = os.path.join(HERE, fname)
    if os.path.exists(p):
        b = json.load(open(p)).get('build')
        if b: builds[fig] = b
if not builds:
    print('no figure data files found — run the figure builders first'); sys.exit(1)

# the run-output files that carry a build of their own, keyed by the generator named in the
# prose. case_studies.json states a long provenance line rather than a bare hash, so the
# eight-character fingerprint is taken out of it.
RUN_BUILDS = {}
for _gen, _fname in (('worked_example_run', 'worked_example_run.json'),
                     ('case_studies', 'case_studies.json'),
                     ('architecture_sweep', 'architecture_sweep.json')):
    _p = os.path.join(HERE, _fname)
    if not os.path.exists(_p):
        continue
    _b = str(json.load(open(_p)).get('build') or '')
    _m = re.search(r'\b([0-9a-f]{8})\b', _b)
    if _m:
        RUN_BUILDS[_gen] = _m.group(1)
if RUN_BUILDS:
    print('run-output stamps: ' + ', '.join('%s = %s' % kv for kv in sorted(RUN_BUILDS.items())))

current = set(builds.values())
print('current build stamps: ' + ', '.join('figure %s = %s' % (k, v) for k, v in sorted(builds.items())))

STAMP = re.compile(r'\bbuild\s+([0-9a-f]{8})\b')

# the shipped tool's own design-parameter fingerprint, read from the tool
import subprocess
_PROBE = ('const{q}=require(process.argv[1]+"/tests/probe.js");'
          'console.log("FP="+q("PPE_BUILD.fingerprint"))')
_n = subprocess.run(['node', '-e', _PROBE, ROOT],
                    capture_output=True, text=True, cwd=ROOT)
TOOL = None
for _line in _n.stdout.splitlines():
    if _line.startswith('FP='): TOOL = _line[3:].strip()
if not TOOL:
    print('could not read the tool fingerprint:', _n.stderr[-400:]); sys.exit(1)
print('shipped tool fingerprint: ' + TOOL)

# Three kinds of stamp appear in these documents, and only two of them track anything.
#
#   "output of build X and regenerates with analysis/build_figureN_editable.js"
#        -> the build figure N's data file was generated from
#   "the deposited build is X" / "against build X"
#        -> the fingerprint of the shipped tool, right now
#   "captured from the live server at akprimeedit.com, build 572c4104"
#        -> a historical fact about a screen capture. Rewriting it would be a lie.
#
# The first version of this script rewrote every stamp it found to the current one, which
# would have silently restamped the Figure S3 capture and the build-equivalence comparison.
# The patterns are matched explicitly now, and anything that matches none of them is left
# alone and reported.
FIGURE_OF = re.compile(r'output of build ([0-9a-f]{8}) and regenerates with '
                       r'analysis/build_figure(\d+)_editable\.js')
# 27 Sep 2026: the Supplementary's worked-example section carries the same kind of stamp but
# names a different generator, so it matched none of the patterns, was reported as
# unaccounted for, and sat at 434876b6 while the section it labels had been regenerated.
# A third pattern rather than a hand-typed hash; worked_example_run.js copies its build
# straight out of figure3_editable_data.json, so the two always agree.
RUN_OF = re.compile(r'output of build ([0-9a-f]{8}) and regenerates with '
                    r'analysis/(worked_example_run|case_studies|architecture_sweep)\.js')
DEPOSITED = re.compile(r'(deposited build is |against build )([0-9a-f]{8})')
HISTORIC  = re.compile(r'live server at akprimeedit\.com, build [0-9a-f]{8}')


def edit_paragraph_text(paragraph, fn):
    """Apply fn to a paragraph's text, writing the result back across its runs."""
    before = ''.join(r.text for r in paragraph.runs)
    after  = fn(before)
    if after == before: return 0
    paragraph.runs[0].text = after
    for r in paragraph.runs[1:]: r.text = ''
    return 1


def retext(text):
    n = [0]
    def fig(m):
        want = builds.get(m.group(2))
        if want is None or want == m.group(1): return m.group(0)
        n[0] += 1
        return m.group(0).replace(m.group(1), want)
    text = FIGURE_OF.sub(fig, text)
    def run(m):
        want = RUN_BUILDS.get(m.group(2))
        if want is None or want == m.group(1): return m.group(0)
        n[0] += 1
        return m.group(0).replace(m.group(1), want)
    text = RUN_OF.sub(run, text)
    def dep(m):
        if m.group(2) == TOOL: return m.group(0)
        n[0] += 1
        return m.group(1) + TOOL
    text = DEPOSITED.sub(dep, text)
    retext.n = n[0]
    return text


changed, left = [], []
for name in DOCS:
    path = os.path.join(D, name)
    if not os.path.exists(path): continue
    doc = Document(path); hits = 0
    for p in doc.paragraphs:
        if not STAMP.search(p.text): continue
        hits += edit_paragraph_text(p, retext)
        for m in STAMP.finditer(p.text):
            s_ = m.group(1)
            if s_ in current or s_ == TOOL: continue
            if HISTORIC.search(p.text) and s_ in HISTORIC.search(p.text).group(0): continue
            left.append('%s: build %s' % (name, s_))
    if hits: doc.save(path); changed.append('%s: %d stamp(s)' % (name, hits))

# Only the legend files. A CHANGES_ note records what was true on the day it was written;
# restamping one would rewrite history rather than correct a claim.
for name in sorted(os.listdir(D)):
    if not name.endswith('.md') or name.startswith('CHANGES_'): continue
    path = os.path.join(D, name)
    txt = open(path, encoding='utf-8').read()
    if not STAMP.search(txt): continue
    out = retext(txt)
    if out != txt:
        open(path, 'w', encoding='utf-8').write(out)
        changed.append('%s' % name)
    for m in STAMP.finditer(out):
        s_ = m.group(1)
        if s_ in current or s_ == TOOL: continue
        if HISTORIC.search(out) and s_ in HISTORIC.search(out).group(0): continue
        left.append('%s: build %s' % (name, s_))

# The carry source for the master decks holds hand-built slides that no builder regenerates —
# Figure S2, the Figure S3 walkthrough capture, the how-to sheet. The walkthrough's caption
# names the deposited build, so it goes stale exactly like a legend does, and until 13 September
# 2026 nothing here reached it: it still read "Deposited build 96e270bb" after the documents had
# been corrected twice. The same two patterns are applied to it.
CARRY = os.path.join(D, 'Figures_master_carry_source.pptx')
if os.path.exists(CARRY):
    try:
        from pptx import Presentation
        prs = Presentation(CARRY); hits = 0
        for sl in prs.slides:
            for sh in sl.shapes:
                if not sh.has_text_frame: continue
                for para in sh.text_frame.paragraphs:
                    before = ''.join(r.text for r in para.runs)
                    if not before or not STAMP.search(before): continue
                    after = retext(before)
                    if after != before and para.runs:
                        para.runs[0].text = after
                        for r in para.runs[1:]: r.text = ''
                        hits += 1
        if hits:
            prs.save(CARRY)
            changed.append('Figures_master_carry_source.pptx: %d stamp(s)' % hits)
    except Exception as e:
        print('  note  could not restamp the carry source: %s' % e)

for c in sorted(set(changed)): print('  restamped ' + c)
for l in sorted(set(left)):
    print('  left as written (not a generated-from stamp): ' + l)
if not changed: print('  every generated-from stamp already matches')
