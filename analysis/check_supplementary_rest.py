#!/usr/bin/env python3
"""
check_supplementary_rest.py

analysis/check_supplementary_tables.py covers Tables S2, S6, S7, S11 and S12, the worked
example, the build stamps and the display items.  It does not cover S1, S3, S4, S5, S8, S9, S10
or either document's reference list, and on 27 September 2026 two of those uncovered tables were
wrong:

  * Table S8, the key to data/benchmark_scored.csv, specified NINE column names the file does
    not contain — four with no counterpart at all (study_doi, pe_system, efficiency_assay,
    plantpegdesigner_score) and five under names the file does not use (pegrna_id, pbs_length,
    rt_length, nick_distance, published_design_rank_percentile).  The one thing the table exists
    to let a reader do, it could not.

  * Table S4 marked two rows CONSTANT and then said "62% of the weight is fixed", which is
    40 + 15 + the unmarked 7% PAM row.  The arithmetic was right and the rows did not say so.

This covers the gap, and one thing more that had been got wrong by the checking rather than by
the documents: REFERENCE INTEGRITY.  An earlier pass reported Li 2023 and Xu 2020 as cited
nowhere, using a pattern whose character class excluded the full stop in "et al." — so
"Xu et al. (2020)" never matched, and both were in fact cited in the Supplementary.  The
citation forms these documents actually use are enumerated below and asserted in both
directions, so the check cannot be quietly wrong again.

    python3 analysis/check_supplementary_rest.py [--dir DIR]

Exit status is non-zero if anything disagrees.
"""
import sys as _s; _s.dont_write_bytecode = True   # a deposit should not ship __pycache__
import argparse
import csv
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default=os.environ.get('PPE_DOCS',
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'documents')))
args = ap.parse_args()

# The submitted documents are not part of the code deposit; say so and stop
# rather than crashing or reporting a missing file as a disagreement.
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from need_documents import require as _require   # noqa: E402
_require([os.path.join(args.dir, 'Supplementary_Data.docx')], 'check_supplementary_rest.py', '--dir')

from docx import Document

P = F = 0


def ck(name, cond, detail=''):
    global P, F
    if cond:
        P += 1
        print('  ok    %-58s %s' % (name, detail))
    else:
        F += 1
        print('  FAIL  %-58s %s' % (name, detail))


def probe(expr):
    """Evaluate a JavaScript expression inside the shipped tool."""
    js = ('const {q}=require(process.argv[1]+"/tests/probe.js");'
          'console.log("R="+q(' + json.dumps(expr) + '))')
    out = subprocess.run(['node', '-e', js, ROOT], capture_output=True, text=True, cwd=ROOT)
    for line in out.stdout.splitlines():
        if line.startswith('R='):
            return line[2:]
    return None


SUPP = Document(os.path.join(args.dir, 'Supplementary_Data.docx'))
MAN = Document(os.path.join(args.dir, 'Manuscript_PlantPrimeEditor.docx'))


def table_by_header(doc, first_two):
    for t in doc.tables:
        hdr = [c.text.strip() for c in t.rows[0].cells]
        if hdr[:len(first_two)] == first_two:
            return t
    return None


def cell_names(cell_text):
    return [n.strip() for n in re.split(r'[,/]', cell_text) if n.strip()]


# ── Table S8 against the file it specifies ──────────────────────────────────
print('Table S8 - the benchmark column specification')
t8 = table_by_header(SUPP, ['Column', 'Meaning'])
ck('Table S8 is present', t8 is not None)
if t8 is not None:
    with open(os.path.join(ROOT, 'data', 'benchmark_scored.csv')) as fh:
        cols = next(csv.reader(fh))
    # A row whose meaning cell is empty and whose first cell names no column is a section
    # heading; a row whose meaning cell is empty and which DOES name a column is the old
    # fault — a column listed and left undescribed — and still fails below.
    named, headings = [], []
    for r in t8.rows[1:]:
        names = cell_names(r.cells[0].text)
        if not r.cells[1].text.strip() and not any(n in cols for n in names):
            headings.append(r.cells[0].text.strip())
            continue
        named += names
    absent = [n for n in named if n not in cols]
    ck('every column S8 names exists in the file', not absent,
       '%d names in %d rows under %d headings' % (len(named), len(t8.rows) - 1, len(headings))
       if not absent else 'absent: ' + ', '.join(absent))

    # THE OTHER DIRECTION, added 27 September 2026. Until now nothing asked whether the key
    # covers the file. It described 19 of 60 columns and passed, because every name it did
    # give was real. A key that opens a third of the doors fails the one job it has.
    silent = [c for c in cols if c not in named]
    ck('every column in the file is described in S8', not silent,
       'all %d columns' % len(cols) if not silent
       else '%d not described: %s' % (len(silent), ', '.join(silent[:12])))

    dupes = sorted({n for n in named if named.count(n) > 1})
    ck('no column is described twice in S8', not dupes, ', '.join(dupes) or 'none')

    empty = [r.cells[0].text.strip() for r in t8.rows[1:]
             if not r.cells[1].text.strip() and r.cells[0].text.strip() not in headings]
    ck('every S8 row that names a column states a meaning', not empty, ', '.join(empty))

    # the counts S8 quotes are re-computed from the file, not taken on trust
    sys.path.insert(0, os.path.join(ROOT, 'analysis'))
    from benchmark_columns import STATED_COUNTS                            # noqa: E402
    with open(os.path.join(ROOT, 'data', 'benchmark_scored.csv')) as fh:
        brows = list(csv.DictReader(fh))
    blob8 = ' '.join(c.text for r in t8.rows for c in r.cells)
    wrong = []
    for label, col, val, want in STATED_COUNTS:
        got = sum(1 for r in brows if r.get(col) == val)
        if label not in blob8:
            wrong.append('%s is not in the table' % label)
        elif got != want:
            wrong.append('%s but the file has %d' % (label, got))
    ck('every row count S8 quotes matches the file', not wrong,
       '%d counts' % len(STATED_COUNTS) if not wrong else '; '.join(wrong[:4]))

# ── Table S4's fixed weights must add to the figure it states ──────────────
print('\nTable S4 - the specificity composite')
t4 = table_by_header(SUPP, ['Component', 'Weight in the composite'])
ck('Table S4 is present', t4 is not None)
if t4 is not None:
    fixed = 0
    varying = 0
    stated = None
    for r in t4.rows[1:]:
        w = r.cells[1].text.strip()
        m = re.match(r'(\d+)%', w)
        if m:
            n = int(m.group(1))
            if 'CONSTANT' in w or 'fixed' in r.cells[0].text or 'ONE value' in r.cells[0].text:
                fixed += n
            else:
                varying += n
        m2 = re.search(r'(\d+)% of the weight is fixed', w)
        if m2:
            stated = int(m2.group(1))
    ck('the rows marked fixed add up to the figure S4 states',
       stated is not None and fixed == stated,
       'rows marked fixed = %d%%, S4 states %d%%' % (fixed, stated if stated else -1))
    ck('the varying weights are the ones the engine reports',
       varying == 38, 'table %d%%, engine reports GC 20 + PAM-proximal 10 + homopolymer 8 = 38%%' % varying)
    # the range S4 states must be reachable, not merely sampled
    rng = probe('computeSpacerSpecificity("ACGTACGTACGTACGTACGT","NGG").observed_range')
    lo = probe('computeSpacerSpecificity("TAATTTTAAGAAAAATGGGT","NGG").score')
    hi = probe('computeSpacerSpecificity("ACGTACGTACGTACGTACGT","NGG").score')
    m = re.search(r'(\d+)\D+(\d+)', rng or '')
    ck('the stated range is reachable at both ends',
       m is not None and lo == m.group(1) and hi == m.group(2),
       'stated %s; adversarial minimum %s, clean maximum %s' % (m.group(0) if m else '?', lo, hi))

# ── Tables S9 and S10 against their data files ─────────────────────────────
print('\nTables S9 and S10 - against the files they were built from')
at = json.load(open(os.path.join(ROOT, 'data', 'all_tools.json')))
t9 = table_by_header(SUPP, ['Target'])
# S9 is the one whose header names the tools
t9 = None
for t in SUPP.tables:
    hdr = [c.text.strip() for c in t.rows[0].cells]
    if hdr and hdr[0] == 'Target' and any('PRIDICT' in h for h in hdr) and 'Spacer' in ' '.join(hdr):
        t9 = t
ck('Table S9 is present', t9 is not None)
if t9 is not None:
    hdr = [c.text.strip() for c in t9.rows[0].cells]
    MAP = {'Plant Prime Editor': 'Plant Prime Editor', 'PlantPeg-Designer': 'PlantPegDesigner',
           'peg-Finder': 'pegFinder', 'PE-Designer': 'PE-Designer', 'PRIDICT': 'PRIDICT'}
    bad, checked = [], 0
    for r in t9.rows[1:]:
        c = [x.text.strip() for x in r.cells]
        rec = at.get(c[0])
        if rec is None:
            bad.append('no data for target %r' % c[0])
            continue
        checked += 1
        if rec['Plant Prime Editor']['sp'] != c[1]:
            bad.append('%s spacer' % c[0])
        for j, h in enumerate(hdr):
            if h in MAP:
                checked += 1
                if str(rec[MAP[h]]['pbs']) != c[j]:
                    bad.append('%s/%s doc=%s data=%s' % (c[0], h, c[j], rec[MAP[h]]['pbs']))
    ck('Table S9 matches data/all_tools.json', not bad,
       '%d cells' % checked if not bad else '; '.join(bad[:3]))

pv = json.load(open(os.path.join(ROOT, 'data', 'pridict_vs_measured.json')))
rows = pv if isinstance(pv, list) else pv.get('rows')
src = {(str(r['target']), int(r['pbs'])): r for r in rows}
t10 = None
for t in SUPP.tables:
    hdr = [c.text.strip() for c in t.rows[0].cells]
    if hdr and hdr[0] == 'Target' and any('PBS length' in h for h in hdr):
        t10 = t
ck('Table S10 is present', t10 is not None)
if t10 is not None:
    bad, n = [], 0
    for r in t10.rows[1:]:
        c = [x.text.strip() for x in r.cells]
        if not c[0] or not c[1].isdigit():
            continue
        rec = src.get((c[0], int(c[1])))
        if rec is None:
            bad.append('no data row for %s / %s' % (c[0], c[1]))
            continue
        n += 1
        for col, field in ((2, 'eff'), (3, 'hek'), (4, 'k562')):
            # The document displays a rounded value, so the test is that it shows the CORRECTLY
            # rounded data value at the precision it prints, not that the two are equal. An
            # earlier ad-hoc pass compared against field names that do not exist in this file,
            # so the comparison was skipped and reported as agreement.
            # Exact equality, not a rounding allowance. Two OsAAT cells used to display a
            # 2-decimal rendering of a 3-decimal source value, and did it inconsistently --
            # 0.275 was rounded up to 0.28 while 0.075 was truncated to 0.07, understating a
            # measured efficiency. The table now carries the data's own values, so the contract
            # is simply that it shows them.
            # The contract differs by column, and saying which is the point.
            #   measured efficiency  EXACT. It is a published measurement, so the table carries
            #     the source's own precision. Two OsAAT cells used to show a 2-decimal rendering
            #     of a 3-decimal value, and did it inconsistently -- 0.275 rounded up to 0.28
            #     while 0.075 was truncated to 0.07, understating a measured efficiency.
            #   PRIDICT scores      CORRECTLY ROUNDED to the precision shown. These are model
            #     outputs carried at full float precision in the data file; printing
            #     70.0964897871 in a table would be false precision, so 70.10 is right.
            shown = c[col]
            try:
                if field == 'eff':
                    ok_cell = float(shown) == float(rec[field])
                    why = 'doc=%s data=%s (this column is exact)' % (shown, rec[field])
                else:
                    dp = len(shown.split('.')[1]) if '.' in shown else 0
                    want = round(float(rec[field]) + 1e-9, dp)
                    ok_cell = float(shown) == want
                    why = 'doc=%s data=%s rounds to %s' % (shown, rec[field], want)
                if not ok_cell:
                    bad.append('%s/%s %s %s' % (c[0], c[1], field, why))
            except (ValueError, IndexError):
                bad.append('%s/%s col%d not numeric: %r' % (c[0], c[1], col, shown))
    ck('Table S10 matches data/pridict_vs_measured.json', not bad,
       '%d rows' % n if not bad else '; '.join(bad[:3]))

# ── the Word and Excel copies of every shared table must agree ─────────────
# analysis/sync_supplementary_xlsx.py syncs Table S2, S7 and S11 by name, and says so in its
# docstring — but it prints "already in sync", which reads as a statement about the workbook.
# On 27 September 2026 it printed that while the Excel copy still carried BOTH uncorrected
# tables: the nine phantom column names in S8 and the two truncated cells in S10. Narrow sync
# is fine; an unchecked remainder is not. This compares every sheet whose name matches a Word
# table, cell by cell, with the Word copy as the authority.
print('\nThe Word and Excel copies of each shared table')
try:
    import openpyxl
    XL = os.path.join(args.dir, 'Supplementary_Tables_v1.0.xlsx')
    wb = openpyxl.load_workbook(XL, data_only=True)
except Exception as exc:                                    # pragma: no cover
    ck('the workbook opens', False, str(exc))
    wb = None

if wb is not None:
    def norm(v):
        if v is None:
            return ''
        t = str(v).strip()
        # a number written 0.275 in one copy and 0.275000 in the other is the same number
        try:
            return '%g' % float(t)
        except ValueError:
            return re.sub(r'\s+', ' ', t)

    def docx_rows(tbl):
        return [[norm(c.text) for c in r.cells] for r in tbl.rows]

    def sheet_rows(ws, header):
        """Rows of the sheet from its header row onward, trimmed to the header's width."""
        out, started = [], False
        for row in ws.iter_rows():
            vals = [norm(c.value) for c in row]
            if not started:
                if vals[:len(header)] == header:
                    started = True
                    out.append(vals[:len(header)])
                continue
            if any(vals):
                out.append(vals[:len(header)])
        return out

    drift, compared = [], 0
    for name in wb.sheetnames:
        m = re.match(r'Table (S\d+)$', name)
        if not m:
            continue
        # find the Word table with the same header
        ws = wb[name]
        cand = None
        for t in SUPP.tables:
            hdr = docx_rows(t)[0]
            if sheet_rows(ws, hdr)[:1]:
                cand = (t, hdr)
                break
        if cand is None:
            continue
        t, hdr = cand
        d_rows = docx_rows(t)
        x_rows = sheet_rows(ws, hdr)
        if not x_rows:
            continue
        compared += 1
        # compare the first column of every Word row against the sheet, which is what a reader
        # matches them by; then the whole row where the keys line up
        # Several of these tables repeat their leading column — Table S10 lists each target once
        # per primer-binding-site length, Table S11 once per architecture AND locus — so the key
        # is the fewest leading columns that are unique across the Word rows, computed per table
        # rather than guessed. Keying on one column collapsed S10; keying on two collapsed S11.
        body = [r for r in d_rows[1:] if r and r[0]]
        kw = 1
        for width in range(1, min(5, len(hdr)) + 1):
            keys = [tuple(r[:width]) for r in body]
            if len(set(keys)) == len(keys):
                kw = width
                break
        else:
            kw = min(4, len(hdr))

        def keyof(r):
            return tuple(r[:kw])

        x_by_key = {}
        for r in x_rows[1:]:
            if r and r[0]:
                x_by_key.setdefault(keyof(r), r)
        for r in d_rows[1:]:
            if not r or not r[0]:
                continue
            xr = x_by_key.get(keyof(r))
            if xr is None:
                drift.append('%s: Word row %r is not in the sheet' % (name, r[0][:40]))
                continue
            for j in range(min(len(r), len(xr))):
                if r[j] != xr[j]:
                    drift.append('%s row %r col %d: Word=%r sheet=%r'
                                 % (name, r[0][:24], j, r[j][:34], xr[j][:34]))
    ck('no table drifts between the Word and Excel copies', not drift,
       '%d tables compared' % compared if not drift else '; '.join(drift[:3]))

# ── reference integrity, both documents, both directions ───────────────────
# The forms these documents use, all of which must count as a citation:
#   Anzalone et al., 2019   Anzalone et al. (2019)   Li H et al. 2026
#   Zhao Y et al. 2025      Lin 2021                 (Lin et al., 2020; Xu et al., 2020)
# An earlier pass used a class that excluded '.', so "Xu et al. (2020)" did not match and two
# references were reported uncited when both were cited. The pattern is spelled out here.
print('\nReference integrity')


def cite_pattern(surname, year):
    return re.compile(
        re.escape(surname)
        + r'(?:\s+[A-Z]\.?)?'                                    # optional initial: "Li H"
        + r'(?:\s+et\s+al\.?|\s+and\s+[A-Z][A-Za-z’\'-]+)?'  # "et al." or "and Smith"
        + r'[\s,;’\']*\(?' + year)


def doc_parts(doc):
    ps = [p.text.strip() for p in doc.paragraphs]
    try:
        lo = next(i for i, t in enumerate(ps) if t == 'References')
    except StopIteration:
        lo = len(ps)
    refs = [t for t in ps[lo + 1:] if re.match(r'^[A-Z][A-Za-z’\'-]+,', t)]
    body = ' '.join(ps[:lo]) + ' ' + ' '.join(
        p.text for t in doc.tables for r in t.rows for c in r.cells for p in c.paragraphs)
    return refs, body


for label, doc in (('Supplementary_Data.docx', SUPP), ('Manuscript_PlantPrimeEditor.docx', MAN)):
    refs, body = doc_parts(doc)
    uncited = []
    for r in refs:
        m = re.match(r'^([A-Z][A-Za-z’\'-]+)', r)
        y = re.search(r'\((\d{4})\)', r)
        if not m or not y:
            continue
        if not cite_pattern(m.group(1), y.group(1)).search(body):
            uncited.append(m.group(1) + ' ' + y.group(1))
    ck('every reference listed in %s is cited' % label, not uncited,
       '%d references' % len(refs) if not uncited else ', '.join(uncited))

# the two that were reported uncited on a broken pattern; named so the mistake cannot recur
srefs, sbody = doc_parts(SUPP)
for sur, yr, where in (('Li', '2023', 'Supplementary'), ('Xu', '2020', 'Supplementary')):
    ck('%s %s is recognised as cited in the %s' % (sur, yr, where),
       bool(cite_pattern(sur, yr).search(sbody)), '')

print()
print('%d ok, %d FAILED' % (P, F))
sys.exit(1 if F else 0)
