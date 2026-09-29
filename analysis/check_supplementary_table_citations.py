#!/usr/bin/env python3
"""
Every reference listed in the supplementary tables document is cited in a table, and every
citation in a table is listed — checked in both directions.

A reference list is the one part of a document nobody proofreads, because it reads as correct
whatever it contains. Two failure modes hide there:

    listed but never cited     an entry the reader is never sent to
    cited but never listed     a citation the reader cannot follow

This reads the tables and their captions for citations, reads the entries under the References
heading, and compares the two sets on (first author's surname, year).

THE MATCHING IS DELIBERATELY BLUNT, because a clever pattern got this wrong once already: an
earlier ad-hoc pass used a character class that excluded the full stop in "et al.", so
"Xu et al. (2020)" never matched and two references were reported as cited nowhere when both
were cited. The pattern here accepts every form these documents actually use —

    Lin et al. (2021)      Lin et al., 2021       Lin et al. 2021
    SantaLucia (1998)      SantaLucia, 1998       Needleman and Wunsch (1970)
    Nelson et al. (2022), Nature Biotechnology 40, 402-410

— and a surname may carry a hyphen, an apostrophe or a diacritic.

Where two entries share a surname and a year they are reported as an ambiguity rather than
silently matched, since (surname, year) would no longer identify one work.

    python3 analysis/check_supplementary_table_citations.py --docx PATH

Exit status 1 if anything disagrees.
"""
import argparse
import re
import sys

ap = argparse.ArgumentParser()
ap.add_argument('--docx', required=True)
ap.add_argument('--verbose', action='store_true')
a = ap.parse_args()

from docx import Document                                                  # noqa: E402
from docx.table import Table                                               # noqa: E402
from docx.text.paragraph import Paragraph                                  # noqa: E402

OK, BAD = [], []


def ck(what, ok, got=''):
    (OK if ok else BAD).append((what, got))


doc = Document(a.docx)

# ── split the document at the References heading ────────────────────────────
blocks = []
for ch in doc.element.body.iterchildren():
    if ch.tag.endswith('}p'):
        blocks.append(('P', Paragraph(ch, doc)))
    elif ch.tag.endswith('}tbl'):
        blocks.append(('T', Table(ch, doc)))

ref_at = next((i for i, (k, o) in enumerate(blocks)
               if k == 'P' and o.text.strip().lower() == 'references'), None)
ck('the document has a References heading', ref_at is not None,
   'paragraph %s' % ref_at)
if ref_at is None:
    for w, g in BAD:
        print('  FAIL  %s  %s' % (w, g))
    sys.exit(1)

body_text = []
for k, o in blocks[:ref_at]:
    if k == 'P':
        body_text.append(o.text)
    else:
        body_text.extend(c.text for r in o.rows for c in r.cells)
BODY = '\n'.join(body_text)

entries = [o.text.strip() for k, o in blocks[ref_at + 1:]
           if k == 'P' and len(o.text.strip()) > 40]

# ── what the list contains ──────────────────────────────────────────────────
SUR = r"[A-Z][A-Za-zÀ-ÿ'’\-]+"
listed, dupes = {}, []
for e in entries:
    m = re.match(r'^(%s)' % SUR, e)
    y = re.search(r'\((\d{4})\)', e)
    if not m or not y:
        BAD.append(('a reference entry has no surname-and-year opening', e[:60]))
        continue
    key = (m.group(1), y.group(1))
    if key in listed:
        dupes.append(key)
    listed[key] = e
ck('every entry opens with a surname and a year in parentheses',
   not [w for w, g in BAD], '%d entries' % len(entries))
ck('no two entries share a surname and a year', not dupes,
   'unambiguous' if not dupes else ', '.join('%s %s' % d for d in dupes))

# ── what the tables cite ────────────────────────────────────────────────────
# The "and Surname" alternative is non-capturing, so the year is group 2 whichever branch
# matched; naming the groups removes the chance of counting them wrong again.
CITE = re.compile(
    r'(?P<sur>%s)'                                   # surname
    r'(?:\s+et\s+al\.?|\s+and\s+(?:%s))?'           # et al., or "and Surname"
    r'[,\s]*\(?(?P<year>\d{4})\)?' % (SUR, SUR))
cited = {}
for m in CITE.finditer(BODY):
    sur, year = m.group('sur'), m.group('year')
    if sur.lower() in ('table', 'figure', 'supplementary', 'in', 'the', 'see', 'no',
                       'nt', 'tm', 'pbs', 'rt', 'pe', 'from', 'of'):
        continue
    if not (1900 <= int(year) <= 2100):
        continue
    cited.setdefault((sur, year), 0)
    cited[(sur, year)] += 1

uncited = sorted(k for k in listed if k not in cited)
unlisted = sorted(k for k in cited if k not in listed)

ck('every reference in the list is cited in a table or its caption', not uncited,
   '%d of %d cited' % (len(listed) - len(uncited), len(listed)) if not uncited
   else 'never cited: ' + '; '.join('%s %s' % k for k in uncited))
ck('every citation in a table appears in the reference list', not unlisted,
   '%d distinct citations' % len(cited) if not unlisted
   else 'not listed: ' + '; '.join('%s %s' % k for k in unlisted))

if a.verbose:
    print('  citations found, with the number of places each is used:')
    for k in sorted(cited):
        print('      %-22s %d' % ('%s %s' % k, cited[k]))
    print()

for w, g in OK:
    print('  ok    %-62s %s' % (w[:62], g))
for w, g in BAD:
    print('  FAIL  %-62s %s' % (w[:62], g))
print('\n  %d ok, %d FAILED' % (len(OK), len(BAD)))
sys.exit(1 if BAD else 0)
