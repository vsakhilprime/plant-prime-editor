#!/usr/bin/env python3
"""
Check Supplementary Table S13 against the deposit, not against the list that wrote it.

S13 tells a reviewer which file to open, which command to type, and where the result appears.
Every one of those is a claim about the deposit, and the failure mode is the one Table S8 had:
a table of names that do not resolve. So this reads the table back out of
Supplementary_Data.docx and checks each cell against the filesystem, the manuscript and the
other documents. It imports nothing from analysis/analysis_index_rows.py — a checker that reads
the patcher's own list can only confirm that a copy was made.

What is asserted:

  * the table is there, before the reference list, with the five expected column headers
  * every row is complete: no empty cell in any of the five columns
  * every data or script path named in any cell exists in the deposit, and a path written with
    a trailing slash is a directory
  * every command names an interpreter that matches its script's extension, and every script
    it names exists
  * no row gives analysis/merge_benchmark.py as a command on its own — running that alone
    leaves data/benchmark_scored.csv without the columns the scorer adds, which is the trap
    the note under the table exists to describe, and the note is asserted to describe it
  * every figure, table and Data S1 reference in the last column resolves to something that
    exists: main figures and Figure S* in Figure_Legends.docx or the supplementary, Table S*
    in the supplementary, Table 1 in the manuscript
  * the Word copy and the Excel copy hold the same rows, cell for cell
  * both contents lists carry a Table S13 row, and Data availability points at the table
  * with --run, every command in the table is executed from the deposit root and required to
    exit 0

    python3 analysis/check_supplementary_s13.py [--dir DIR] [--run]

Exit status 1 if anything disagrees.
"""
import sys as _s; _s.dont_write_bytecode = True   # a deposit should not ship __pycache__
import argparse
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default=os.environ.get('PPE_DOCS',
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'documents')))
ap.add_argument('--run', action='store_true',
                help='execute every command in the table and require exit 0')
a = ap.parse_args()


# The submitted documents are not part of the code deposit; say so and stop
# rather than crashing or reporting a missing file as a disagreement.
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from need_documents import require as _require   # noqa: E402
_require([os.path.join(a.dir, 'Supplementary_Data.docx'), os.path.join(a.dir, 'Manuscript_PlantPrimeEditor.docx'), os.path.join(a.dir, 'Figure_Legends.docx'), os.path.join(a.dir, 'Supplementary_Tables_v1.0.xlsx')], 'check_supplementary_s13.py', '--dir')

from docx import Document                                                  # noqa: E402
from docx.table import Table                                              # noqa: E402
from docx.text.paragraph import Paragraph                                 # noqa: E402
import openpyxl                                                            # noqa: E402

OK, BAD = [], []


def say(ok, what, got):
    (OK if ok else BAD).append((what, got))


SPATH = os.path.join(a.dir, 'Supplementary_Data.docx')
MPATH = os.path.join(a.dir, 'Manuscript_PlantPrimeEditor.docx')
LPATH = os.path.join(a.dir, 'Figure_Legends.docx')
XPATH = os.path.join(a.dir, 'Supplementary_Tables_v1.0.xlsx')

sup = Document(SPATH)

# ── locate the table, and the reference list it must precede ────────────────
blocks = []
for ch in sup.element.body.iterchildren():
    if ch.tag.endswith('}tbl'):
        blocks.append(('T', Table(ch, sup)))
    elif ch.tag.endswith('}p'):
        # a Paragraph, not the raw element: itertext() on a w:p that carries fallback markup
        # yields its text more than once, which is how the reference heading came out as
        # "ReferencesReferencesReferences" and the position check failed on a correct document.
        blocks.append(('P', Paragraph(ch, sup)))

HEADERS = ['Result reported', 'Input data in the deposit', 'Command',
           'Output of record', 'Where it appears']

s13 = s13_at = None
for i, (kind, obj) in enumerate(blocks):
    if kind == 'T' and [c.text.strip() for c in obj.rows[0].cells] == HEADERS:
        s13, s13_at = obj, i
say(s13 is not None, 'Table S13 is in Supplementary_Data.docx with its five column headers',
    'found' if s13 is not None else 'NOT FOUND')
if s13 is None:
    for w, g in BAD:
        print('  FAIL  %-70s %s' % (w, g))
    sys.exit(1)

refs_i = next((i for i, (k, o) in enumerate(blocks)
               if k == 'P' and o.text.strip() == 'References'), None)
say(refs_i is not None and s13_at < refs_i,
    'Table S13 sits before the reference list',
    'table at %s, references at %s' % (s13_at, refs_i))

caption = next((o.text.strip() for k, o in blocks
                if k == 'P' and o.text.strip().startswith('Table S13')), '')
say(caption.startswith('Table S13.'), 'Table S13 has a numbered caption', caption[:60] or 'NONE')

# the note under the table must describe the two-stage benchmark rebuild
doc_text = '\n'.join(o.text for k, o in blocks if k == 'P')
for phrase in ('merge_benchmark.py', 'score_batch_v2.js',
               'without the columns the scorer adds'):
    say(phrase in doc_text, 'the note under Table S13 mentions %s' % phrase,
        'present' if phrase in doc_text else 'MISSING')

# ── read the rows ───────────────────────────────────────────────────────────
rows, groups = [], []
for r in s13.rows[1:]:
    cells = [c.text.strip() for c in r.cells]
    if cells[0] and not any(cells[1:]):     # a section heading: column one only
        groups.append(cells[0])
        continue
    say(len(cells) == 5, 'every row has five columns', '%d columns' % len(cells))
    rows.append(cells[:5])

say(len(rows) >= 20, 'Table S13 indexes the analyses rather than a sample',
    '%d analyses in %d rows, %d section headings' % (len(rows), len(s13.rows) - 1, len(groups)))
for i, cells in enumerate(rows):
    empty = [HEADERS[j] for j, c in enumerate(cells) if not c]
    say(not empty, 'row %d is complete' % (i + 1),
        'complete' if not empty else 'EMPTY: ' + ', '.join(empty))

# ── every path named anywhere in the table exists in the deposit ────────────
PATH = re.compile(r'\b(?:data|analysis|tests|DataS1|docs)/[A-Za-z0-9_./-]*|'
                  r'\bplant_prime_editor_v1\.0\.html\b')
seen = set()
for cells in rows:
    for cell in cells:
        for tok in PATH.findall(cell):
            tok = tok.rstrip('.,;')
            if tok in seen:
                continue
            seen.add(tok)
            full = os.path.join(ROOT, tok)
            if tok.endswith('/'):
                say(os.path.isdir(full), 'a directory the table names: %s' % tok,
                    'directory' if os.path.isdir(full) else 'NOT A DIRECTORY')
            else:
                say(os.path.exists(full), 'a file the table names: %s' % tok,
                    'exists' if os.path.exists(full) else 'DOES NOT EXIST')
say(len(seen) >= 25, 'the table names a substantial part of the deposit',
    '%d distinct paths' % len(seen))

# ── commands: interpreter matches extension, script exists ──────────────────
CMD = re.compile(r'\b(node|python3)\s+((?:analysis|tests)/[A-Za-z0-9_.-]+\.(?:js|py))')
for cells in rows:
    cmd = cells[2]
    found = CMD.findall(cmd)
    say(bool(found), 'the command column names a runnable script: %s' % cmd[:46],
        '%d command(s)' % len(found) if found else 'NO COMMAND FOUND')
    for interp, script in found:
        want = 'node' if script.endswith('.js') else 'python3'
        say(interp == want, '%s is run with %s' % (script, want), interp)
        say(os.path.exists(os.path.join(ROOT, script)), '%s is in the deposit' % script,
            'exists' if os.path.exists(os.path.join(ROOT, script)) else 'MISSING')
    if 'merge_benchmark.py' in cmd:
        say('score_batch_v2.js' in cmd,
            'the benchmark row names both pipeline stages, not merge_benchmark.py alone',
            'both stages' if 'score_batch_v2.js' in cmd else 'ONLY THE MERGE STAGE')

# ── the last column resolves ────────────────────────────────────────────────
legends = Document(LPATH)
leg_text = '\n'.join(p.text for p in legends.paragraphs)
man = Document(MPATH)
man_text = '\n'.join(p.text for p in man.paragraphs)
sup_titles = [p.text.strip() for p in sup.paragraphs]

refs_named = set()
for cells in rows:
    where = cells[4]
    for m in re.finditer(r'\bFigure S(\d+)\b', where):
        refs_named.add('FigureS' + m.group(1))
    for m in re.finditer(r'\bFigure (\d+)\b', where):
        refs_named.add('Figure' + m.group(1))
    for m in re.finditer(r'\bTables? S(\d+)(?:–S(\d+))?\b', where):
        lo = int(m.group(1))
        hi = int(m.group(2)) if m.group(2) else lo
        for n in range(lo, hi + 1):
            refs_named.add('TableS%d' % n)
    if re.search(r'\bTable 1\b', where):
        refs_named.add('Table1')
    if re.search(r'\bData S1\b', where):
        refs_named.add('DataS1ref')

for ref in sorted(refs_named):
    if ref.startswith('FigureS'):
        n = ref[7:]
        hit = ('Supplementary Figure S%s' % n) in leg_text or \
              any(t.startswith('Figure S%s' % n) for t in sup_titles) or \
              ('Figure S%s' % n) in leg_text
    elif ref.startswith('Figure'):
        n = ref[6:]
        hit = any(t.startswith('Figure %s.' % n) for t in
                  [p.text.strip() for p in legends.paragraphs])
    elif ref.startswith('TableS'):
        n = ref[6:]
        hit = any(t.startswith('Table S%s.' % n) or t.startswith('Table S%s ' % n)
                  for t in sup_titles)
    elif ref == 'Table1':
        hit = 'Table 1.' in man_text
    else:
        hit = 'Supplementary Data S1' in '\n'.join(sup_titles)
    say(hit, 'the reference %s resolves to something that exists' % ref,
        'resolves' if hit else 'RESOLVES TO NOTHING')

# ── the Word copy and the Excel copy agree ──────────────────────────────────
wb = openpyxl.load_workbook(XPATH)
say('Table S13' in wb.sheetnames, 'the workbook carries a Table S13 sheet',
    'present' if 'Table S13' in wb.sheetnames else 'MISSING')
if 'Table S13' in wb.sheetnames:
    ws = wb['Table S13']
    hdr_row = next((i for i in range(1, ws.max_row + 1)
                    if (ws.cell(row=i, column=1).value or '') == HEADERS[0]), None)
    say(hdr_row is not None, 'the Excel sheet has the same header row',
        'row %s' % hdr_row)
    if hdr_row:
        xrows = []
        for i in range(hdr_row + 1, ws.max_row + 1):
            vals = [(ws.cell(row=i, column=j).value or '').strip() for j in range(1, 6)]
            if not any(vals):
                continue
            if not any(vals[1:]):            # group heading
                continue
            xrows.append(vals)
        say(len(xrows) == len(rows), 'both copies hold the same number of analyses',
            'Word %d, Excel %d' % (len(rows), len(xrows)))
        norm = lambda s: re.sub(r'\s+', ' ', s).strip()
        bad = []
        for i, (w, x) in enumerate(zip(rows, xrows)):
            for j in range(5):
                if norm(w[j]) != norm(x[j]):
                    bad.append('row %d, %s' % (i + 1, HEADERS[j]))
        say(not bad, 'every cell agrees between the Word and Excel copies',
            'identical' if not bad else 'DIFFER: ' + '; '.join(bad[:4]))

# ── the contents lists and the manuscript pointer ───────────────────────────
cont = next(Table(ch, sup) for ch in sup.element.body.iterchildren()
            if ch.tag.endswith('}tbl'))
say(any(r.cells[0].text.strip() == 'Table S13' for r in cont.rows),
    'the document contents list includes Table S13', 'present')
cs = wb['Contents']
xitems = [(cs.cell(row=i, column=1).value or '').strip() for i in range(1, cs.max_row + 1)]
say('Table S13' in xitems, 'the workbook contents list includes Table S13', 'present')

say('Table S13' in man_text, 'the manuscript points a reader at Table S13',
    'Data availability' if 'Table S13' in man_text else 'NO POINTER')

# the pointer must not be inside the counted main text
ps = [p for p in man.paragraphs]
names = [p.text.strip() for p in ps]
lo, hi = names.index('Abstract'), names.index('Materials availability')
counted = '\n'.join(p.text for p in ps[lo:hi])
say('Table S13' not in counted,
    'the pointer sits outside the 7,000-word main text span',
    'outside' if 'Table S13' not in counted else 'INSIDE THE COUNT')

# ── optionally run every command ────────────────────────────────────────────
if a.run:
    ran, skipped, seen_output = [], [], {}
    for cells in rows:
        # The benchmark row is the one command this checker must NOT run. Stage 1 rewrites
        # data/benchmark_scored.csv without the columns stage 2 adds, and stage 2 writes to
        # standard output, so running the pair here would leave the deposit's benchmark
        # half-built — a checker that damages what it checks. It is reported as skipped, with
        # the reason, rather than silently passed.
        if 'merge_benchmark.py' in cells[2]:
            skipped.append('the two-stage benchmark rebuild (it rewrites '
                           'data/benchmark_scored.csv)')
            continue
        row_blob, row_keys = [], []
        for stage in re.split(r';|\bthen\b', cells[2]):
            m = CMD.search(stage)
            if not m:
                continue
            cmd = [m.group(1), m.group(2)]
            extra = stage[m.end():].strip()
            if extra.startswith('data/'):
                cmd.append(extra.split()[0])
            key = ' '.join(cmd)
            row_keys.append(key)
            if key in ran:
                row_blob.append(seen_output.get(key, ''))
                continue
            ran.append(key)
            r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
            say(r.returncode == 0, 'runs: %s' % key,
                'exit 0' if r.returncode == 0 else 'EXIT %d: %s'
                % (r.returncode, (r.stderr or r.stdout).strip().splitlines()[-1:][0][:70]
                   if (r.stderr or r.stdout).strip() else 'no output'))
            seen_output[key] = (r.stdout or '') + (r.stderr or '')
            row_blob.append(seen_output[key])

        # The "output of record" column quotes a tally. Quoting one no command in that row
        # still prints is the same fault as naming a column a file does not have. A row may
        # run more than one command, so the tallies are checked against everything the row
        # printed rather than against one stage — attributing them stage by stage made the
        # supplementary row's "19 ok" a failure against the command that prints "all checks
        # pass", which is a correct line from the other stage.
        joined = '\n'.join(row_blob)
        for tally in re.findall(r'\d+ (?:passed, \d+ failed|ok, \d+ FAILED|'
                                r'checks?, \d+ disagree)', cells[3]):
            say(tally in joined, 'the tally S13 quotes for %s' % (', '.join(row_keys) or '?'),
                tally if tally in joined
                else 'S13 says %r; the row printed something else' % tally)
    print('  (ran %d distinct commands)' % len(ran))
    for s in skipped:
        print('  not run: %s' % s)

# ── report ──────────────────────────────────────────────────────────────────
for w, g in OK:
    print('  ok    %-72s %s' % (w[:72], g))
for w, g in BAD:
    print('  FAIL  %-72s %s' % (w[:72], g))
print('\n  %d ok, %d FAILED' % (len(OK), len(BAD)))
sys.exit(1 if BAD else 0)
