#!/usr/bin/env python3
"""
The manuscript's reference list and the supplementary tables' reference list are in one
format, and neither misrepresents an author list.

A reference list is the one part of a submission nobody proofreads, because it reads as
correct whatever it contains. Four faults can hide there, and all four were present on
29 September 2026:

    a shared reference worded two different ways in the two documents
    a truncated author list presented as complete, naming the wrong last author
    a journal title spelled one way here and another way there
    an entry that is bold throughout because it was written into a single run

The third and fourth are cosmetic. The second is not: writing
"…, Sahin, M., and Osborn, M.J. (2021)" for a paper with fourteen authors tells the reader
that Chen et al. (2021) ends at Osborn, when its last author is Liu.

WHAT IS CHECKED

  1  Every entry in either list carries a DOI, and no DOI appears twice in one list.
  2  A reference the two documents share is worded identically, character for character.
  3  An entry names every author when the paper has ten or fewer, and exactly ten
     followed by "et al." when it has more. The published author counts are frozen in
     analysis/reference_format.py from Crossref, so this needs no network.
  4  An entry that names its authors in full ends with the paper's real last author.
  5  No full journal title survives where the manuscript uses an abbreviation.
  6  Every entry is bold for its author list and regular thereafter, in both documents.

    python3 analysis/check_reference_format.py --manuscript PATH --supplementary PATH

Exit status 1 if anything disagrees. It needs the submitted documents; without them it says
so and exits 0, like the other document-dependent checkers.
"""
import argparse
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib.need_documents import require                                           # noqa: E402
from reference_format import PUBLISHED, ET_AL_AFTER, FULL_TITLES                 # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--manuscript', default=None)
ap.add_argument('--supplementary', default=None)
a = ap.parse_args()

def in_docs(*names):
    """The first of these file names that exists in PPE_DOCS, or None.

    The submitted files have been renamed once already, so the older names are tried too
    rather than leaving the script to report a missing document that is sitting right there.
    """
    docs = os.environ.get('PPE_DOCS')
    if not docs:
        # Return the expected name rather than None. require() ignores a None, and
        # python-docx opens its own blank template when handed one, so a missing document
        # became fifteen "ok" lines about nothing until this was caught on 29 September 2026.
        return names[0]
    for n in names:
        p = os.path.join(docs, n)
        if os.path.exists(p):
            return p
    return os.path.join(docs, names[0])


MAN = a.manuscript or in_docs('final_manuscript_28-09-2026.docx',
                              'Manuscript_PlantPrimeEditor.docx')
SUP = a.supplementary or in_docs('Final_Supplementary_tables.docx',
                                 'Supplementary_Data.docx')
require([MAN, SUP], 'check_reference_format.py', flag='--manuscript/--supplementary')

from docx import Document                                                        # noqa: E402

OK, BAD = [], []


def ck(what, ok, got=''):
    (OK if ok else BAD).append((what, got))


def norm(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()


DOI = re.compile(r'https?://doi\.org/(10\.\S+?)\.?$')
# A surname followed by a comma and initials. The initials may be hyphenated (Qiu, J.-L.)
# or doubled (Anzalone, A.V.), and the surname may carry a diacritic (Schönig, Tálas).
NAME = re.compile(r"([A-ZÀ-Þ][A-Za-zÀ-ÿ'’\-]+),\s*(?:[A-Z]\.(?:-?[A-Z]\.)*)")


def read(path, label):
    doc = Document(path)
    ps = list(doc.paragraphs)
    i = next((i for i, p in enumerate(ps) if p.text.strip().lower() == 'references'), None)
    ck('%s has a References heading' % label, i is not None)
    if i is None:
        return []
    out = []
    for p in ps[i + 1:]:
        t = p.text.strip()
        if len(t) <= 40:
            continue
        m = DOI.search(t)
        runs = [(bool(r.font.bold), r.text) for r in p.runs if r.text.strip()]
        out.append({'text': ' '.join(t.split()),
                    'doi': m.group(1).rstrip('.') if m else None,
                    'runs': runs,
                    'head': t.split('(')[0]})
    return out


MANR = read(MAN, 'the manuscript')
SUPR = read(SUP, 'the supplementary tables')
ck('the manuscript reference list was read', bool(MANR), '%d entries' % len(MANR))
ck('the supplementary reference list was read', bool(SUPR), '%d entries' % len(SUPR))

# ── 1. every entry carries a DOI, and no DOI twice in one list ──────────────
for label, rows in (('manuscript', MANR), ('supplementary', SUPR)):
    nodoi = [r['text'][:40] for r in rows if not r['doi']]
    ck('every %s entry carries a DOI' % label, not nodoi,
       '%d entries' % len(rows) if not nodoi else '; '.join(nodoi[:3]))
    seen, dupe = set(), []
    for r in rows:
        if r['doi'] in seen:
            dupe.append(r['doi'])
        seen.add(r['doi'])
    ck('no DOI appears twice in the %s list' % label, not dupe,
       '%d distinct' % len(seen) if not dupe else ', '.join(dupe))

# ── 2. a shared reference is worded identically ─────────────────────────────
mbd = {r['doi']: r for r in MANR if r['doi']}
shared = [r for r in SUPR if r['doi'] in mbd]
differ = [r['doi'] for r in shared if r['text'] != mbd[r['doi']]['text']]
ck('every reference both documents carry is worded identically', not differ,
   '%d shared entries' % len(shared) if not differ
   else '%d differ: %s' % (len(differ), ', '.join(differ[:3])))
if differ:
    for d in differ[:3]:
        BAD.append(('    manuscript', mbd[d]['text'][:96]))
        BAD.append(('    supplementary', next(r['text'] for r in SUPR if r['doi'] == d)[:96]))

# ── 3 and 4. the author list says what the published record says ────────────
for label, rows in (('manuscript', MANR), ('supplementary', SUPR)):
    wrong_n, wrong_last, unknown = [], [], []
    for r in rows:
        pub = PUBLISHED.get(r['doi'])
        if pub is None:
            unknown.append(r['doi'])
            continue
        n_pub, last_pub = pub
        names = NAME.findall(r['head'])
        etal = 'et al.' in r['head']
        who = r['head'].split(',')[0]
        if n_pub > ET_AL_AFTER:
            # More than ten authors: exactly ten named, then et al.
            if not etal:
                wrong_n.append('%s writes out all %d authors instead of ten and et al.'
                               % (who, len(names)))
            elif len(names) != ET_AL_AFTER:
                wrong_n.append('%s names %d before et al., not %d'
                               % (who, len(names), ET_AL_AFTER))
        else:
            # Ten or fewer: every one of them, and no et al.
            if etal:
                wrong_n.append('%s uses et al. for a %d-author paper' % (who, n_pub))
            elif len(names) != n_pub:
                wrong_n.append('%s prints %d of %d authors as if complete'
                               % (who, len(names), n_pub))
        # The last author is checked whenever the entry claims a complete list, whether or
        # not the count came out right — a list that is both short and misattributed should
        # say so twice rather than let the count failure mask the misattribution.
        if not etal and names and norm(names[-1]) != norm(last_pub):
            wrong_last.append('%s ends at %s; the published last author is %s'
                              % (who, names[-1], last_pub))
    ck('every %s DOI has a published author count on record' % label, not unknown,
       '%d entries' % len(rows) if not unknown else 'not recorded: ' + ', '.join(unknown[:3]))
    ck('every %s entry names all authors, or ten and et al.' % label, not wrong_n,
       'all %d follow the rule' % len(rows) if not wrong_n else '; '.join(wrong_n[:4]))
    ck('no %s entry names the wrong last author' % label, not wrong_last,
       'none' if not wrong_last else '; '.join(wrong_last[:4]))

# ── 5. journal names ────────────────────────────────────────────────────────
for label, rows in (('manuscript', MANR), ('supplementary', SUPR)):
    full = []
    for r in rows:
        for title, abbrev in FULL_TITLES.items():
            if title in r['text']:
                full.append('%s prints "%s", not "%s"'
                            % (r['head'].split(',')[0], title, abbrev))
    ck('every %s entry abbreviates its journal name' % label, not full,
       '%d entries' % len(rows) if not full else '; '.join(sorted(set(full))[:4]))

# ── 6. the author list is bold and the rest is not ──────────────────────────
for label, rows in (('manuscript', MANR), ('supplementary', SUPR)):
    bad = []
    for r in rows:
        if not r['runs']:
            continue
        if all(b for b, _ in r['runs']):
            bad.append('%s is bold throughout' % r['head'].split(',')[0])
        elif not r['runs'][0][0]:
            bad.append('%s does not open in bold' % r['head'].split(',')[0])
    ck('every %s entry is bold for its authors and regular after' % label, not bad,
       '%d entries' % len(rows) if not bad else '; '.join(bad[:4]))

for w, g in OK:
    print('  ok    %-64s %s' % (w[:64], g))
for w, g in BAD:
    print('  FAIL  %-64s %s' % (w[:64], g))
print('\n  %d ok, %d FAILED' % (len(OK), len(BAD)))
sys.exit(1 if BAD else 0)
