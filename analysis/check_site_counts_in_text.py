#!/usr/bin/env python3
"""
Check every site count and sweep count the documents state against the deposit.

analysis/verify_manuscript_numbers.py compares the deposit against LITERALS typed into that
script, so it catches an analysis that has drifted from the paper only if someone remembers
to update the literal. This reads the documents themselves and re-derives each number, so a
sentence left behind by an edit fails here rather than shipping.

It also fails on any surviving statement of the superseded values, which is the failure mode
that matters: a corrected Results paragraph and an uncorrected legend saying different things
about the same panel.

    python3 analysis/check_site_counts_in_text.py [--dir DIR]
Exit status 1 if anything disagrees.
"""
import sys as _s; _s.dont_write_bytecode = True   # a deposit should not ship __pycache__
import argparse, collections, csv, json, os, re, sys

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default=os.environ.get('PPE_DOCS',
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'documents')))
a = ap.parse_args()


# The submitted documents are not part of the code deposit; say so and stop
# rather than crashing or reporting a missing file as a disagreement.
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from need_documents import require as _require   # noqa: E402
_require([os.path.join(a.dir, 'Manuscript_PlantPrimeEditor.docx')], 'check_site_counts_in_text.py', '--dir')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'lib'))
from target_site import site_of_row                                      # noqa: E402
from docx import Document                                                # noqa: E402

J = lambda p: json.load(open(os.path.join(ROOT, p)))
C = lambda p: list(csv.DictReader(open(os.path.join(ROOT, p), newline='', encoding='utf-8-sig')))

SW, WS = J('analysis/architecture_sweep.json'), J('analysis/weight_sensitivity.json')
PERM = J('analysis/recovery_permutation.json')
bench, verif = C('data/benchmark_scored.csv'), C('data/targets_verified.csv')
ok_verif = [r for r in verif if str(r.get('status', '')).startswith('OK')]
ranked = [r for r in bench if str(r.get('published_rank_percentile', '')).strip()]
nick = [f for f in SW['failures'] if f['why'] == 'no nicking sgRNA']
pair = [f for f in SW['failures'] if f['why'].startswith('no opposite-strand')]

DOCS = ['Manuscript_PlantPrimeEditor.docx', 'Figure_Legends.docx', 'Supplementary_Data.docx']


def text_of(path):
    d = Document(path)
    parts = [p.text for p in d.paragraphs]
    parts += [c.text for t in d.tables for r in t.rows for c in r.cells]
    return '\n'.join(parts)


BLOBS = {}
for f in DOCS:
    p = os.path.join(a.dir, f)
    if os.path.exists(p):
        BLOBS[f] = text_of(p)
ALL = '\n'.join(BLOBS.values())

OK, BAD = [], []


def must(desc, phrase, where=None):
    """A phrase built from the data must appear in at least one document."""
    blobs = BLOBS if where is None else {k: v for k, v in BLOBS.items() if k in where}
    hit = [f for f, b in blobs.items() if phrase in b]
    (OK if hit else BAD).append((desc, phrase, ', '.join(hit) or 'FOUND NOWHERE'))


def never(desc, phrase):
    """A superseded phrase must appear nowhere."""
    hit = [f for f, b in BLOBS.items() if phrase in b]
    (OK if not hit else BAD).append((desc, 'absent: ' + phrase, ', '.join(hit) or 'absent'))


# ── the counts the documents must state, each re-derived ─────────────────────────
n_complete, n_declined = SW['complete'], SW['incomplete']
n_nick, n_nick_loci = len(nick), len({f['locus'] for f in nick})
n_sites162 = len({site_of_row(r) for r in ok_verif})
n_sites141 = len({site_of_row(r) for r in bench})
n_sites135 = len({site_of_row(r) for r in ranked})
# WS['loci'] is the number of DESIGNS, one per (site, edit) pair, not the number of sites:
# analysis/weight_sensitivity.json carries 31 per_locus rows over 25 distinct `site` values
# and names the count `distinct_designs`. The Results and the Figure 2D legend used to call
# it a count of sites, which contradicted the 25 stated everywhere else in the paper.
n_ws = WS['distinct_designs']
n_ws_sites = WS.get('distinct_sites') or len({x['site'] for x in WS['per_locus']})
WORD = {1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 11: 'eleven',
        12: 'twelve', 13: 'thirteen', 14: 'fourteen'}
# Extended on 28 September 2026: the PE3b/PE5b decline moved from twelve loci to thirteen
# when the fourth edit-quotation convention brought a twenty-sixth site into the sweep, and
# this map had no entry for it, so the checker raised KeyError instead of checking.

must('architecture sweep, complete designs',
     '%d of %d combinations return a complete design' % (n_complete, SW['combinations']))
must('architecture sweep, the declined count (Results)',
     'The %d that do not' % n_declined, ['Manuscript_PlantPrimeEditor.docx'])
must('architecture sweep, the declined count (supplementary)',
     'Of the %d that do not' % n_declined, ['Supplementary_Data.docx'])
must('architecture sweep, PE3b/PE5b (Results)',
     '%d are PE3b and PE5b at %d loci' % (n_nick, n_nick_loci),
     ['Manuscript_PlantPrimeEditor.docx'])
must('architecture sweep, PE3b/PE5b (supplementary)',
     '%d are PE3b and PE5b at %s loci' % (n_nick, WORD[n_nick_loci]),
     ['Supplementary_Data.docx'])
must('architecture sweep, the loci PE3b declines at',
     'decline at %d loci' % n_nick_loci, ['Supplementary_Data.docx'])
must('weight sweep, the cohort size (Results)',
     'for each of the %d designs at the %d benchmark loci' % (n_ws, n_ws_sites),
     ['Manuscript_PlantPrimeEditor.docx'])
must('weight sweep, designs not sites (legend)',
     'each of the %d designs the %d target sites return' % (n_ws, n_ws_sites))
never('weight sweep called a count of sites',
      '%d distinct target sites' % n_ws)
must('weight sweep, channel off', 'one selection of %d' % n_ws)
must('weight sweep, the maximum', 'more than one of %d' % n_ws)
must('weight sweep, the movers',
     'The %s designs that ever move' % WORD[WS['n_movers']])
must('cascade, sites among the 162', 'spanning %d target sites' % n_sites162,
     ['Manuscript_PlantPrimeEditor.docx'])
must('cascade, sites among the 141',
     '%d scored pegRNAs at %d sites' % (len(bench), n_sites141),
     ['Manuscript_PlantPrimeEditor.docx'])
must('cascade, sites among the 135', 'at %d sites' % n_sites135)
must('design recovery, the cohort',
     '%d at %d target sites' % (PERM['pegRNAs_ranked'], PERM['target_sites']),
     ['Supplementary_Data.docx'])

# ── the superseded wordings, which must survive nowhere ──────────────────────────
for phrase in ('248 of 275', '135 pegRNAs at 25 target sites', '76 of 135', '31 designs', '24 are PE3b',
               '250 of 275', 'The 25 that do not', 'Of the 25 that do not',
               '22 are PE3b and PE5b', 'at 11 loci', 'at eleven loci',
               'decline at 11 loci', 'each of 32 benchmark loci',
               'the 32 benchmark loci', 'two of 32',
               'The five loci that ever move', 'spanning 33 target sites',
               'too few candidates for a percentile'):
    never('superseded wording', phrase)

# ── the two documents that share the Figure 2D legend must share it exactly ──────
if 'Manuscript_PlantPrimeEditor.docx' in BLOBS and 'Figure_Legends.docx' in BLOBS:
    def panelD(blob):
        # Anchor on "(D) The heaviest weight…", not on the sentence alone: the manuscript's
        # Limitations paragraph opens with the same words, and matching that swallowed the
        # rest of the Discussion — 27,000 characters compared against a 1,400-character
        # legend, which of course "differed".
        i = blob.find('(D) The heaviest weight in the platform')
        j = blob.find('(E)', i + 1)
        return re.sub(r'\s+', ' ', blob[i:j]).strip() if i >= 0 else None
    m, l = panelD(BLOBS['Manuscript_PlantPrimeEditor.docx']), panelD(BLOBS['Figure_Legends.docx'])
    (OK if m and m == l else BAD).append(
        ('the Figure 2D legend is identical in the manuscript and Figure_Legends.docx',
         'identical', 'identical' if m and m == l else 'THEY DIFFER'))

# ── the main text is still under the limit ───────────────────────────────────────
mp = os.path.join(a.dir, 'Manuscript_PlantPrimeEditor.docx')
if os.path.exists(mp):
    d = Document(mp)
    ps = list(d.paragraphs)
    names = [x.text.strip() for x in ps]
    lo, hi = names.index('Abstract'), names.index('Materials availability')
    n = sum(len(x.text.split()) for x in ps[lo:hi]
            if x.text.strip() and not x.style.name.startswith('Heading')
            and not x.text.strip().startswith('Keywords:'))
    (OK if n <= 7000 else BAD).append(
        ('main text within the 7,000-word limit', '%d words' % n,
         'margin %d' % (7000 - n) if n <= 7000 else 'OVER BY %d' % (n - 7000)))

# ── report ───────────────────────────────────────────────────────────────────────
print('documents read: %s' % (', '.join(BLOBS) or 'NONE'))
if not BLOBS:
    print('nothing to check — pass --dir at the folder holding the three documents')
    sys.exit(1)
for desc, phrase, where in OK:
    print('  ok    %-52s %s' % (desc, where))
for desc, phrase, where in BAD:
    print('  FAIL  %-52s %s\n          %s' % (desc, where, phrase))
print('\n%d checks, %d disagree' % (len(OK) + len(BAD), len(BAD)))
sys.exit(1 if BAD else 0)
