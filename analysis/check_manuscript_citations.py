#!/usr/bin/env python3
"""
Every reference in the manuscript's list is cited in the manuscript, and every citation in the
manuscript is in its list — checked in both directions.

The companion to analysis/check_supplementary_table_citations.py, which does the same for the
supplementary tables. The two failure modes are the same:

    listed but never cited     an entry the reader is never sent to
    cited but never listed     a citation the reader cannot follow

and the matching is deliberately blunt for the same reason: a clever pattern got this wrong
once already, excluding the full stop in "et al." so that "Xu et al. (2020)" never matched and
two cited references were reported as uncited.

TWO THINGS IN THE TEXT LOOK LIKE CITATIONS AND ARE NOT

    "ECMAScript 2020"   a language edition, in the software implementation paragraph
    "30 March 2026"     a filing date, in the copyright registration sentence

Both are listed below with the reason, rather than filtered by a rule that might quietly
swallow a real citation whose first author happens to be called March.

    python3 analysis/check_manuscript_citations.py --docx PATH [--verbose]

Exit status 1 if anything disagrees. It needs the submitted manuscript; without it the script
says so and exits 0.
"""
import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib.need_documents import require                                           # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--docx', default=None)
ap.add_argument('--verbose', action='store_true')
a = ap.parse_args()

DOCS = os.environ.get('PPE_DOCS')
NAMES = ('final_manuscript_28-09-2026.docx', 'Manuscript_PlantPrimeEditor.docx')
DOCX = a.docx
if DOCX is None:
    # The submitted manuscript has been renamed once, so the older name is tried too rather
    # than reporting a missing document that is sitting right there under another name.
    # Never None: require() ignores a None, and python-docx opens its own blank template when
    # handed one, so a missing manuscript became a page of "ok" lines about nothing until
    # this was caught on 29 September 2026.
    DOCX = next((os.path.join(DOCS, n) for n in NAMES
                 if DOCS and os.path.exists(os.path.join(DOCS, n))),
                os.path.join(DOCS, NAMES[0]) if DOCS else NAMES[0])
require([DOCX], 'check_manuscript_citations.py', flag='--docx')

from docx import Document                                                        # noqa: E402
from docx.table import Table                                                     # noqa: E402
from docx.text.paragraph import Paragraph                                        # noqa: E402

OK, BAD = [], []


def ck(what, ok, got=''):
    (OK if ok else BAD).append((what, got))


# A capitalised word before a four-digit year is a citation unless it is one of these.
NOT_A_CITATION = {
    ('ECMAScript', '2020'): 'the language edition the tool is written in, not a work',
    ('March', '2026'): 'the date the copyright registration was filed',
}

doc = Document(DOCX)

blocks = []
for ch in doc.element.body.iterchildren():
    if ch.tag.endswith('}p'):
        blocks.append(('P', Paragraph(ch, doc)))
    elif ch.tag.endswith('}tbl'):
        blocks.append(('T', Table(ch, doc)))

ref_at = next((i for i, (k, o) in enumerate(blocks)
               if k == 'P' and o.text.strip().lower() == 'references'), None)
ck('the manuscript has a References heading', ref_at is not None, 'paragraph %s' % ref_at)
if ref_at is None:
    for w, g in BAD:
        print('  FAIL  %s  %s' % (w, g))
    sys.exit(1)

body = []
for k, o in blocks[:ref_at]:
    if k == 'P':
        body.append(o.text)
    else:
        body.extend(c.text for r in o.rows for c in r.cells)
BODY = '\n'.join(body)

entries = [o.text.strip() for k, o in blocks[ref_at + 1:]
           if k == 'P' and len(o.text.strip()) > 40]

SUR = r"[A-Z][A-Za-zÀ-ÿ'’\-]+"

# ── what the list contains ──────────────────────────────────────────────────
listed, dupes, malformed = {}, [], []
for e in entries:
    m = re.match(r'^(%s)' % SUR, e)
    y = re.search(r'\((\d{4})\)', e)
    if not m or not y:
        malformed.append(e[:60])
        continue
    key = (m.group(1), y.group(1))
    if key in listed:
        dupes.append(key)
    listed[key] = e
ck('every entry opens with a surname and a year in parentheses', not malformed,
   '%d entries' % len(entries) if not malformed else '; '.join(malformed[:3]))
ck('no two entries share a surname and a year', not dupes,
   'unambiguous' if not dupes else ', '.join('%s %s' % d for d in dupes))

# ── what the text cites ─────────────────────────────────────────────────────
CITE = re.compile(
    r'(?P<sur>%s)'                                   # surname
    r'(?:\s+et\s+al\.?|\s+and\s+(?:%s))?'            # et al., or "and Surname"
    r'[,\s]*\(?(?P<year>\d{4})\)?' % (SUR, SUR))
GENERIC = ('table', 'figure', 'supplementary', 'in', 'the', 'see', 'no', 'nt', 'tm',
           'pbs', 'rt', 'pe', 'from', 'of', 'and', 'data', 'note', 'version', 'since')
cited, excluded = {}, []
for m in CITE.finditer(BODY):
    sur, year = m.group('sur'), m.group('year')
    if sur.lower() in GENERIC:
        continue
    if not (1900 <= int(year) <= 2100):
        continue
    if (sur, year) in NOT_A_CITATION:
        excluded.append('%s %s — %s' % (sur, year, NOT_A_CITATION[(sur, year)]))
        continue
    cited[(sur, year)] = cited.get((sur, year), 0) + 1

# Every exclusion must earn its place: one that no longer matches anything is a rule left
# behind by an edit, and would hide a real citation if that surname ever appeared.
stale = [k for k in NOT_A_CITATION
         if not any(x.startswith('%s %s ' % k) for x in excluded)]
ck('every documented non-citation is still in the text', not stale,
   '%d excluded' % len(NOT_A_CITATION) if not stale
   else 'no longer present: ' + ', '.join('%s %s' % k for k in stale))

uncited = sorted(k for k in listed if k not in cited)
unlisted = sorted(k for k in cited if k not in listed)

ck('every reference in the list is cited in the manuscript', not uncited,
   '%d of %d cited' % (len(listed) - len(uncited), len(listed)) if not uncited
   else 'never cited: ' + '; '.join('%s %s' % k for k in uncited))
ck('every citation in the manuscript appears in the reference list', not unlisted,
   '%d distinct citations' % len(cited) if not unlisted
   else 'not listed: ' + '; '.join('%s %s' % k for k in unlisted))

if a.verbose:
    print('  citations found, with the number of places each is used:')
    for k in sorted(cited):
        print('      %-22s %d' % ('%s %s' % k, cited[k]))
    print('  looked at and not counted:')
    for x in excluded:
        print('      %s' % x)
    print()

for w, g in OK:
    print('  ok    %-62s %s' % (w[:62], g))
for w, g in BAD:
    print('  FAIL  %-62s %s' % (w[:62], g))
print('\n  %d ok, %d FAILED' % (len(OK), len(BAD)))
sys.exit(1 if BAD else 0)
