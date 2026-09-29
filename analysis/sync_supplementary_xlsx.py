#!/usr/bin/env python3
"""
Make the workbook copy of a supplementary table match the Word copy, cell for cell.

Every supplementary table exists twice — as a Word table in Supplementary_Data.docx and as a
sheet in Supplementary_Tables_v1.0.xlsx — and the two drift, because a correction written
into one is easy to forget in the other. check_supplementary_tables.py compares them, so the
drift is caught; nothing fixed it.

The Word copy is the authority, and not by convention: it is the copy the checker holds
against the engine and against analysis/case_studies.json. This script therefore refuses to
sync a table unless the Word copy still agrees with the deposit — otherwise it would
propagate a stale value into the one place that could have contradicted it.

Currently syncs Table S2 (the scoring terms), Table S7 (the assembly routes) and Table S11
(the case studies). IT DOES NOT SYNC THE REST, so "already in sync" means those three agree and
says nothing about the other seven shared tables. On 27 September 2026 it printed exactly that
while the workbook still carried two uncorrected tables — the nine phantom column names in
Table S8 and the two truncated cells in Table S10. The remainder is now covered by
analysis/check_supplementary_rest.py, which compares EVERY sheet whose name matches a Word
table, cell by cell, with the Word copy as the authority; a narrow sync is fine as long as
nothing goes unchecked. analysis/patch_table_s2.py writes both copies of the cells it owns, but a
correction made anywhere else in Table S2 reaches only the Word table — which is how "the six
wheat designs of Lin et al. 2020", corrected to five in the Word copy, survived in the
workbook.

    python3 analysis/sync_supplementary_xlsx.py [--docx PATH] [--xlsx PATH] [--dry-run]
"""
import argparse, json, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default='.')
ap.add_argument('--docx', default=None)
ap.add_argument('--xlsx', default=None)
ap.add_argument('--dry-run', action='store_true')
a = ap.parse_args()

HERE = os.path.dirname(os.path.abspath(__file__))
DOCX = a.docx or os.path.join(a.dir, 'Supplementary_Data.docx')
XLSX = a.xlsx or os.path.join(a.dir, 'Supplementary_Tables_v1.0.xlsx')
for p in (DOCX, XLSX):
    if not os.path.exists(p):
        sys.exit('not found: %s' % p)

from docx import Document
from openpyxl import load_workbook

doc = Document(DOCX)
wb = load_workbook(XLSX)


def word_table(header, must_contain=None):
    """The Word table whose first row starts with these headings.

    TWO tables carry ['Term', 'Condition'] — S1, the spacer scoring terms, and S2, the
    primer-binding-site ones. Taking the first match syncs S1's rows into S2's sheet, so a
    discriminating row is required where the header alone is ambiguous."""
    for t in doc.tables:
        if [c.text.strip() for c in t.rows[0].cells][:len(header)] != header:
            continue
        if must_contain and not any(r.cells[0].text.strip().startswith(must_contain)
                                    for r in t.rows[1:]):
            continue
        return t
    sys.exit('no Word table with header %s%s' % (header,
             '' if not must_contain else ' containing a row %r' % must_contain))


def sheet_rows(ws, first_header, ncol):
    """(row index, values) for each data row of a sheet, found by its header row."""
    out, start = [], None
    for i in range(1, ws.max_row + 1):
        v = ws.cell(i, 1).value
        if v is not None and str(v).strip() == first_header:
            start = i
            continue
        if start and v is not None and str(v).strip():
            out.append((i, [('' if ws.cell(i, j).value is None
                             else str(ws.cell(i, j).value).strip())
                            for j in range(1, ncol + 1)]))
    return out


changes, problems = [], []


def sync(name, header, ncol, key_col=0, must_contain=None):
    """Overwrite the sheet's cells with the Word table's, matched on the key column."""
    t = word_table(header, must_contain)
    ws = wb['Table ' + name]
    D = {r.cells[key_col].text.strip(): [c.text.strip() for c in r.cells] for r in t.rows[1:]}
    rows = sheet_rows(ws, header[0], ncol)
    seen = set()
    for i, vals in rows:
        k = vals[key_col]
        if k not in D:
            problems.append('%s: sheet row %d (%r) has no Word row' % (name, i, k[:40]))
            continue
        seen.add(k)
        for j in range(ncol):
            want = D[k][j] if j < len(D[k]) else ''
            if vals[j] != want:
                changes.append((name, i, j + 1, vals[j], want))
                if not a.dry_run:
                    ws.cell(i, j + 1).value = want
    for k in D:
        # A Word table can carry a blank continuation row; it is not a missing sheet row.
        if k and k not in seen:
            problems.append('%s: Word row %r has no sheet row' % (name, k[:40]))


def sync_positional(name, header, ncol):
    """Same, but matched by position — for a table whose first column repeats."""
    t = word_table(header)
    ws = wb['Table ' + name]
    D = [[c.text.strip() for c in r.cells] for r in t.rows[1:]]
    rows = sheet_rows(ws, header[0], ncol)
    if len(D) != len(rows):
        problems.append('%s: %d Word rows vs %d sheet rows — not syncing positionally'
                        % (name, len(D), len(rows)))
        return
    for (i, vals), want_row in zip(rows, D):
        for j in range(ncol):
            want = want_row[j] if j < len(want_row) else ''
            if vals[j] != want:
                changes.append((name, i, j + 1, vals[j], want))
                if not a.dry_run:
                    ws.cell(i, j + 1).value = want


# ── the Word copy must still agree with the deposit before it is copied anywhere ──
csj = os.path.join(HERE, 'case_studies.json')
if os.path.exists(csj):
    cs = json.load(open(csj))
    want = (len(cs['controlled']['results']) + len(cs['spread']['results']))
    t11 = word_table(['Panel', 'Architecture', 'Locus'])
    got = len(t11.rows) - 1
    if got != want:
        sys.exit('REFUSING TO SYNC: the Word Table S11 has %d rows, case_studies.json has %d. '
                 'Fix the Word copy first — syncing would write a stale table into the '
                 'workbook, which is the only place that could have contradicted it.'
                 % (got, want))
    # and every Result cell must match the run
    runs = ([('Controlled', r) for r in cs['controlled']['results']]
            + [('Species spread', r) for r in cs['spread']['results']])
    # The Result column is not "did the checks pass" — every one of the 44 passes. It is
    # "did the engine build the design or correctly decline it", which is the same rule
    # check_supplementary_tables.py applies: a non-empty `declined` note means Declined.
    # Reading it as all-checks-pass marked the two correct declines as Pass and refused the
    # sync for a disagreement that did not exist.
    for row, (panel, r) in zip(t11.rows[1:], runs):
        cells = [c.text.strip() for c in row.cells]
        want_res = 'Declined' if r.get('declined') else ('Pass' if r.get('ok') else 'FAIL')
        if cells[-1] != want_res or cells[1] != r['architecture']:
            sys.exit('REFUSING TO SYNC: Word Table S11 row %r/%r does not match '
                     'case_studies.json (%r/%r)' % (cells[1], cells[-1],
                                                    r['architecture'], want_res))

sync('S2', ['Term', 'Condition'], 4, must_contain='Melting temperature')
sync('S7', ['Strategy', 'Enzyme or method', 'Overhangs'], 5)
sync_positional('S11', ['Panel', 'Architecture', 'Locus'], 10)

if changes and not a.dry_run:
    wb.save(XLSX)

by_table = {}
for name, i, j, old, new in changes:
    by_table.setdefault(name, []).append((i, j, old, new))
for name in sorted(by_table):
    rows = by_table[name]
    print('  %-4s %3d cell(s) %s' % (name, len(rows), 'would change' if a.dry_run else 'updated'))
    for i, j, old, new in rows[:6]:
        print('        r%-3d c%-2d  %r -> %r' % (i, j, old[:46], new[:46]))
    if len(rows) > 6:
        print('        … and %d more' % (len(rows) - 6))
if not changes:
    print('  already in sync — no cell differs')
for p in problems:
    print('  FAIL  ' + p)
sys.exit(1 if problems else 0)
