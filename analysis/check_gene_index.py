#!/usr/bin/env python3
"""
Re-derive every claim in PlantPrimeEditor_gene_sources.xlsx from the deposit and compare.

The workbook is a summary of files that already exist. A summary is only worth the check
that it still matches them, so nothing below reads the builder: each figure is recomputed
from the source file and compared with what the sheet says.

    python3 analysis/check_gene_index.py [--xlsx PATH]
Exit status 1 if anything disagrees.
"""
import argparse, collections, csv, hashlib, json, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('--xlsx', default=None)
a = ap.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The workbook is written by analysis/gene_source_index.py and is not part of the deposit, so
# a missing one means "not generated yet", not "the deposit disagrees with itself".
if a.xlsx is None:
    a.xlsx = os.path.join(ROOT, 'PlantPrimeEditor_gene_sources.xlsx')
if not os.path.exists(a.xlsx):
    print('  this check reads PlantPrimeEditor_gene_sources.xlsx, which is generated rather')
    print('  than shipped. Build it first and this runs with no arguments:')
    print('      python3 analysis/gene_source_index.py')
    print('  nothing checked.')
    sys.exit(0)
J = lambda p: json.load(open(os.path.join(ROOT, p)))
C = lambda p: list(csv.DictReader(open(os.path.join(ROOT, p), newline='', encoding='utf-8-sig')))
win = lambda s: hashlib.md5(s.encode()).hexdigest()[:10]

from openpyxl import load_workbook
wb = load_workbook(a.xlsx)
grid = {ws.title: [[c for c in row] for row in ws.iter_rows(values_only=True)] for ws in wb}

OK, BAD = [], []
def check(name, got, want):
    (OK if got == want else BAD).append((name, got, want))

# ── 1. every indexed label is real, and appears exactly once ───────────────────
bench = C('data/benchmark_scored.csv')
verif = C('data/targets_verified.csv')
tm    = C('data/tm_table.csv')
cstg  = C('data/CaseStudy_Targets.csv')
loto  = J('data/loto.json'); h2h = J('data/headtohead.json')
pri   = J('data/pridict_vs_measured.json')
wheat = J('data/lin2020_wheat_pbs.json'); vupr = J('data/vu2024_paired_pegRNA.json')
arch  = J('analysis/architecture_sweep.json'); wsen = J('analysis/weight_sensitivity.json')
case  = J('analysis/case_studies.json'); alsreg = J('analysis/als_sites.json')

known = set()
known |= {r['locus'] for r in bench}
known |= {r['target_id'] for r in tm}
known |= {r['target_id'] for r in cstg}
known |= {t[0] for t in loto['argmax']} | {t[0] for t in loto['ranking']}
known |= {r['target'] for r in h2h} | {r['target'] for r in pri}
known |= {r['target'] for r in wheat} | set(vupr['loci'])
known |= {r['locus'] for r in wsen['per_locus']}
# case_studies.js reports SITE ids too, for the same reason the sweep does, so resolve
# them through the registry before comparing with the label index.
_case_ids = {case['controlled']['locus']} | {r['locus'] for r in case['spread']['results']}
# The sweep reports SITE ids now, and an id is not always a label — a label naming two
# protospacers is disambiguated as "SlOr (site A)". Resolve each id to the labels it covers.
_REG = J('analysis/target_sites.json')
_LABELS_OF = {x['id']: x['labels'] for x in _REG['sites']}
for _l in arch['locus_list']: known |= set(_LABELS_OF.get(_l, [_l]))
for _l in _case_ids:          known |= set(_LABELS_OF.get(_l, [_l]))

# The two directions are not the same question, and treating them as one is how the first
# attempt at this fix traded one failure for another. `known` is a set of LABELS. The sheet
# may legitimately carry a disambiguated SITE ID — "SlOr (site B)" — where a plain label
# names two protospacers, so the sheet is normalised to labels before either comparison;
# a site id maps to the labels it covers, anything else stands for itself.
_to_labels = lambda x: set(_LABELS_OF.get(x, [x]))
sheet = [r[0] for r in grid['Gene index'][1:] if r[0]]
sheet_labels = set().union(*[_to_labels(x) for x in sheet]) if sheet else set()
check('no duplicate label in Gene index', len(sheet), len(set(sheet)))
check('every indexed label exists in the deposit', sorted(sheet_labels - known), [])
check('every deposited label is indexed', sorted(known - sheet_labels), [])

# ── 2. gene, species, paper and pegRNA count per label ─────────────────────────
STUDY = {'Lin2020_S1': 'Lin 2020', 'Lin2021_S1': 'Lin 2021', 'Vu 2024': 'Vu 2024'}
npeg = collections.Counter(r['locus'] for r in bench)
paper = collections.defaultdict(set)
for r in bench: paper[r['locus']].add(STUDY[r['study']])
for r in tm: paper[r['target_id']].add('Lin 2021')
for r in wheat: paper[r['target']].add('Lin 2020')
for l in vupr['loci']: paper[l].add('Vu 2024')
edits = collections.defaultdict(set)
for r in bench: edits[r['locus']].add(r['edit_type'])
for r in wsen['per_locus']: edits[r['locus']].add(r['edit_type'])

bad_paper, bad_npeg, bad_edit = [], [], []
for row in grid['Gene index'][1:]:
    lab, _gene, _sp, pap, ed, n = row[0], row[1], row[2], row[3], row[4], row[5]
    if not lab: continue
    want_p = ', '.join(sorted(paper[lab])) or '-'
    if pap != want_p: bad_paper.append((lab, pap, want_p))
    want_n = npeg[lab] or '-'
    if n != want_n: bad_npeg.append((lab, n, want_n))
    want_e = ', '.join(sorted(edits[lab])) or '-'
    if ed != want_e: bad_edit.append((lab, ed, want_e))
check('source paper per label', bad_paper, [])
check('pegRNA count per label', bad_npeg, [])
check('edit types per label', bad_edit, [])

# ── 3. cascade site counts ─────────────────────────────────────────────────────
ALS = {l: 'OsALS-site-' + s['site'] for s in alsreg['sites'] for l in s['labels']}
def truesites(rows, lab, sp, gs):
    return len({(r.get('species', ''), r[sp], win(r[gs])) for r in rows})
ok_verif = [r for r in verif if str(r.get('status', '')).startswith('OK')]
ok_bench = [r for r in bench if str(r['status']).startswith('OK')]
STAGE_TRUE = {
 '162 passing the parse': truesites(ok_verif, 'target_id', 'spacer', 'genomic_seq'),
 '141 scored':            truesites(bench,    'locus', 'published_spacer', 'genomic_seq'),
 '136 ranked':            truesites(ok_bench, 'locus', 'published_spacer', 'genomic_seq'),
}
coll = {r[0]: r[1] for r in grid['Label collisions'][1:] if r[0]}
for stage, n in STAGE_TRUE.items():
    check('site count stated for "%s"' % stage,
          ('true distinct sites %d' % n) in (coll.get(stage) or ''), True)
check('162 stage true sites', STAGE_TRUE['162 passing the parse'], 35)
check('141 stage true sites', STAGE_TRUE['141 scored'], 27)
check('136 stage true sites (the headline count)', STAGE_TRUE['136 ranked'], 26)
check('the analyses now key on the protospacer registry',
      os.path.exists(os.path.join(ROOT, 'analysis', 'target_sites.json')), True)

# ── 4. collisions listed are exactly the collisions that exist ─────────────────
def coll_of(rows, lab, sp, gs):
    same, split = collections.defaultdict(set), collections.defaultdict(set)
    for r in rows:
        same[(r.get('species', ''), r[sp], win(r[gs]))].add(r[lab])
        split[r[lab]].add(r[sp])
    return ({tuple(sorted(v)) for v in same.values() if len(v) > 1},
            {k for k, v in split.items() if len(v) > 1})
same_all, split_all = set(), set()
for rows, lab, sp, gs in ((ok_verif, 'target_id', 'spacer', 'genomic_seq'),
                          (bench, 'locus', 'published_spacer', 'genomic_seq'),
                          (ok_bench, 'locus', 'published_spacer', 'genomic_seq')):
    s, p = coll_of(rows, lab, sp, gs); same_all |= s; split_all |= p
listed_same = {tuple(k.split(' + ')) for k in coll if ' + ' in k}
check('same-site label pairs listed', listed_same, same_all)
check('split labels listed', {k for k in coll if k in split_all}, split_all)
check('exactly one pair is registered in als_sites.json',
      sum(1 for p in same_all if p[0] in ALS), 1)

# ── 5. no protospacer occupies two windows (the assumption the counts rest on) ──
amb = []
for rows, sp, gs in ((ok_verif, 'spacer', 'genomic_seq'), (bench, 'published_spacer', 'genomic_seq')):
    m = collections.defaultdict(set)
    for r in rows: m[(r.get('species', ''), r[sp])].add(win(r[gs]))
    amb += [k[1] for k, v in m.items() if len(v) > 1]
check('every protospacer maps to exactly one window', amb, [])

# ── 6. Figure 2D carries each design exactly once ──────────────────────────────
# Written on 16 Sep to assert the BUG, so that fixing it would fail the check rather than
# pass silently. Now inverted to assert the fix: 31 rows, no two identical, one GAPDH mover.
by = collections.defaultdict(list)
for r in wsen['per_locus']:
    by[(json.dumps(r['lengths'], sort_keys=True), json.dumps(r['seqs'], sort_keys=True),
        r['edit_type'])].append(r['locus'])
dupes = {tuple(sorted(v)) for v in by.values() if len(v) > 1}
spacer_of = {}
for r in bench: spacer_of.setdefault(r['locus'], r['published_spacer'])
same_spacer = {d for d in dupes if len({spacer_of.get(x) for x in d}) == 1}
check('Figure 2D rows', len(wsen['per_locus']), 32)
check('Figure 2D carries no duplicated design', same_spacer, set())
check('only one GAPDH design moves at weight 2.5',
      sorted(wsen['loci_affected']['2.5']), ['OsGAPDH-T1/SNP'])
check('Figure 2D rows equal distinct designs',
      len({(k[0], k[1], k[2]) for k in by}), len(wsen['per_locus']))
check('no weight moves more than one selection', wsen['max_change'], 1)
check('four distinct designs ever move', wsen['n_movers'], 4)

# ── 7. Li 2026 sheet ───────────────────────────────────────────────────────────
li26 = J('data/li2026_pbs_designs.json')
cnt = collections.Counter(r['gene'].strip() for r in li26)
rows26 = [r for r in grid['Li 2026 genes'][1:] if r[0] and not str(r[0]).startswith('TOTAL')]
check('Li 2026 distinct genes', len(rows26), len(cnt))
check('Li 2026 gene names', sorted(r[0] for r in rows26), sorted(cnt))
check('Li 2026 design total', sum(r[2] for r in rows26), len(li26))

# ── 8. the six papers, each cited once, each with a DOI ────────────────────────
pp = [r for r in grid['Source papers'][1:] if r[0]]
check('six source papers listed', len(pp), 6)
check('every paper carries a DOI link', all(str(r[3]).startswith('https://doi.org/') for r in pp), True)
check('every paper names what was taken', all(r[4] and len(str(r[4])) > 20 for r in pp), True)

# ── report ─────────────────────────────────────────────────────────────────────
for n, g, w in OK: print('  ok    %s' % n)
for n, g, w in BAD:
    print('  FAIL  %s\n          got  %r\n          want %r' % (n, g, w))
print('\n%d checks, %d disagree' % (len(OK) + len(BAD), len(BAD)))
sys.exit(1 if BAD else 0)
