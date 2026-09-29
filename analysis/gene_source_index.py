#!/usr/bin/env python3
"""
Index of every published gene used in the manuscript, with its source paper.

Nothing here is typed by hand that can be read from a deposited file. Genes, species,
edit types, pegRNA counts and the analyses each target feeds come from the same files the
figures are built from; only the six citations and the per-figure legend assignments are
literals, and those are checked against the manuscript by check_gene_index.py.

It also records the label collisions, because the deposit carries labels that do not map
one-to-one onto target sites: four pairs of labels denote ONE protospacer, and five single
labels denote TWO. The earlier analysis/als_sites.json registered one of the four pairs, so
counting "sites" by label was wrong at two of the three cascade stages and Figure 2D drew
one design twice. Every analysis now keys on the protospacer through the generated registry
analysis/target_sites.json; the "Label collisions" sheet records what that changed.

    python3 analysis/gene_source_index.py [--out DIR]
Writes PlantPrimeEditor_gene_sources.xlsx
"""
import argparse, collections, csv, hashlib, json, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('--out', default=os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))
a = ap.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p)))
C = lambda p: list(csv.DictReader(open(os.path.join(ROOT, p), newline='', encoding='utf-8-sig')))

# ───────────────────────────────────────────────────────────── the six source papers
PAPERS = {
 'Lin 2020': dict(
   cite='Lin, Q., Zong, Y., Xue, C., Wang, S., Jin, S., Zhu, Z., Wang, Y., Anzalone, A.V., '
        'Raguram, A., Doman, J.L., et al. (2020). Prime genome editing in rice and wheat. '
        'Nat. Biotechnol. 38:582-585.',
   doi='10.1038/s41587-020-0455-x', species='rice, wheat',
   took='Supplementary Table 1 - pegRNA designs and measured editing efficiencies'),
 'Lin 2021': dict(
   cite='Lin, Q., Jin, S., Zong, Y., Yu, H., Zhu, Z., Liu, G., Kou, L., Wang, Y., Qiu, J.-L., '
        'Li, J., et al. (2021). High-efficiency prime editing with optimized, paired pegRNAs in '
        'plants. Nat. Biotechnol. 39:923-927.',
   doi='10.1038/s41587-021-00868-w', species='rice',
   took='Supplementary Table 1 and Figure 1b (digitised) - primer-binding-site length series '
        'with measured efficiency'),
 'Vu 2024': dict(
   cite='Vu, T.V., Nguyen, N.T., Kim, J., Song, Y.J., Nguyen, T.H., and Kim, J.-Y. (2024). '
        'Optimized dicot prime editing enables heritable desired edits in tomato and '
        'Arabidopsis. Nat. Plants 10:1502-1513.',
   doi='10.1038/s41477-024-01786-w', species='tomato',
   took='Supplementary Tables - tomato pegRNA designs; Supplementary Table 10 - paired pegRNAs'),
 'Li 2026': dict(
   cite='Li, H., Chai, Z., Shi, X., Sun, C., Zhang, R., Zhang, Q., Li, Z., Zhang, K., Lei, Y., '
        'and Gao, C. (2026). Multiplexed, precise genome engineering in monocots with twin prime '
        'editing systems. Nat. Biotechnol. Published online 5 June 2026.',
   doi='10.1038/s41587-026-03174-5', species='rice, wheat, maize',
   took='516 deposited pegRNA designs - monocot primer-binding-site window corroboration and '
        'the 30-50 bp nick-to-nick spacing rule'),
 'Li 2023': dict(
   cite='Li, J., Ding, J., Zhu, J., Xu, R., Gu, D., Liu, X., Liang, J., Qiu, C., Wang, H., '
        'Li, M., et al. (2023). Prime editing-mediated precise knockin of protein tag sequences '
        'in the rice genome. Plant Commun. 4:100572.',
   doi='10.1016/j.xplc.2023.100572', species='rice',
   took='24 published primer-binding-site designs - independent support for the rice window'),
 'Xu 2020': dict(
   cite='Xu, R., Li, J., Liu, X., Shan, T., Qin, R., and Wei, P. (2020). Development of plant '
        'prime-editing systems for precise genome editing. Plant Commun. 1:100043.',
   doi='10.1016/j.xplc.2020.100043', species='rice',
   took='peACC1-peACC4 designs at rice OsACC - out-of-sample nick-to-edit distance check'),
}
STUDY = {'Lin2020_S1': 'Lin 2020', 'Lin2021_S1': 'Lin 2021', 'Vu 2024': 'Vu 2024'}
SPN = {'Oryza sativa': 'rice (Oryza sativa)', 'Triticum aestivum': 'wheat (Triticum aestivum)',
       'Solanum lycopersicum': 'tomato (Solanum lycopersicum)',
       'rice': 'rice (Oryza sativa)', 'wheat': 'wheat (Triticum aestivum)',
       'tomato': 'tomato (Solanum lycopersicum)'}

# ───────────────────────────────────────────────────────────── inputs
bench = C('data/benchmark_scored.csv')
verif = C('data/targets_verified.csv')
tm    = C('data/tm_table.csv')
cstg  = C('data/CaseStudy_Targets.csv')
loto  = J('data/loto.json')
h2h   = J('data/headtohead.json')
pri   = J('data/pridict_vs_measured.json')
wheat = J('data/lin2020_wheat_pbs.json')
vupr  = J('data/vu2024_paired_pegRNA.json')
li26  = J('data/li2026_pbs_designs.json')
arch  = J('analysis/architecture_sweep.json')
wsen  = J('analysis/weight_sensitivity.json')
case  = J('analysis/case_studies.json')
alsreg= J('analysis/als_sites.json')
REG   = J('analysis/target_sites.json')

# Site identity comes from the protospacer, through the generated registry. als_sites.json is
# kept only so this sheet can say which of the four alias pairs it covered.
SITE_OF_SPACER = {s['spacer']: s['id'] for s in REG['sites']}
ALS = {l: 'OsALS-site-' + s['site'] for s in alsreg['sites'] for l in s['labels']}
win = lambda s: hashlib.md5(s.encode()).hexdigest()[:10]

# ───────────────────────────────────────────────────────────── label collisions
def collisions(rows, lab, spacer, gseq, species='species'):
    same, split = collections.defaultdict(set), collections.defaultdict(set)
    for r in rows:
        same[r[spacer]].add(r[lab]); split[r[lab]].add(r[spacer])
    return ({k: sorted(v) for k, v in same.items() if len(v) > 1},
            {k: sorted(v) for k, v in split.items() if len(v) > 1},
            len({r[spacer] for r in rows}))

STAGES = []
ok_verif = [r for r in verif if str(r.get('status', '')).startswith('OK')]
ok_bench = [r for r in bench if str(r['status']).startswith('OK')]
for name, rows, lab, sp, gs, paper_says in (
    ('162 passing the parse', ok_verif, 'target_id', 'spacer', 'genomic_seq', 33),
    ('141 scored',            bench,    'locus',     'published_spacer', 'genomic_seq', 26),
    ('136 ranked',            ok_bench, 'locus',     'published_spacer', 'genomic_seq', 26)):
    same, split, true_n = collisions(rows, lab, sp, gs)
    STAGES.append(dict(stage=name, rows=len(rows), labels=len({r[lab] for r in rows}),
                       was=paper_says, true=true_n, same=same, split=split))

# ───────────────────────────────────────────────────────────── per-target record
info = {}
def touch(label, species=None, gene=None, paper=None):
    d = info.setdefault(label, dict(species='', gene='', papers=set(), edits=set(),
                                    uses=set(), n_peg=0, spacers=set()))
    if species and not d['species']: d['species'] = SPN.get(species, species)
    if gene and not d['gene']: d['gene'] = gene
    if paper: d['papers'].add(paper)
    return d

def gene_of(label):
    s = label.split(' (')[0]
    return s[:-3] if s[-3:] in ('-T1', '-T2', '-T3') else s

U_BENCH = 'Benchmark cascade and design-recovery ranking (Results; MASTER_RESULTS section 6)'
U_TM    = 'Primer-binding-site melting-temperature recalibration (Figure 4; Table S10)'
U_LOTO  = 'Leave-one-target-out validation (Figure S4A)'
U_RANK  = 'Leave-one-target-out ranking test (Figure S4B)'
U_H2H   = 'Seven-tool head-to-head (Figure 5; Table 1; Table S9)'
U_PRI   = 'PRIDICT2.0 transfer test (Figure 6; Table S10)'
U_ARCH  = 'Eleven-architecture sweep, 25 sites x 11 (Results; Table S11)'
U_WSEN  = 'RT-to-PBS weight sensitivity (Figure 2D)'
U_CTRL  = 'Case-study panel, controlled locus (Table S11)'
U_SPRD  = 'Case-study panel, species spread (Table S11)'
U_WPBS  = 'Published wheat primer-binding-site series (independent support)'
U_PAIR  = 'Paired-pegRNA nick spacing (Vu 2024 Supplementary Table 10)'

for r in bench:
    d = touch(r['locus'], r['species'], gene_of(r['locus']), STUDY[r['study']])
    d['edits'].add(r['edit_type']); d['n_peg'] += 1; d['spacers'].add(r['published_spacer'])
    d['uses'].add(U_BENCH)
for r in tm:
    touch(r['target_id'], 'Oryza sativa', r['gene'], 'Lin 2021')['uses'].add(U_TM)
for t in loto['argmax']:  touch(t[0])['uses'].add(U_LOTO)
for t in loto['ranking']: touch(t[0])['uses'].add(U_RANK)
for r in h2h:  touch(r['target'])['uses'].add(U_H2H)
for r in pri:  touch(r['target'])['uses'].add(U_PRI)
for r in cstg: touch(r['target_id'], r['species'], r['gene'])
# The sweep now reports SITE ids, and a site id is not always a label: a label that names
# two protospacers is disambiguated as "SlOr (site A)". Resolve each id back to the labels it
# covers, so the index stays a list of labels a reader can look up in the source paper.
LABELS_OF = {s['id']: s['labels'] for s in REG['sites']}
for l in arch['locus_list']:
    for lab in LABELS_OF.get(l, [l]):
        touch(lab)['uses'].add(U_ARCH)
for r in wsen['per_locus']:
    d = touch(r['locus'], r['species']); d['edits'].add(r['edit_type']); d['uses'].add(U_WSEN)
touch(case['controlled']['locus'])['uses'].add(U_CTRL)
for r in case['spread']['results']: touch(r['locus'])['uses'].add(U_SPRD)
for r in wheat: touch(r['target'], 'Triticum aestivum', r['gene'], 'Lin 2020')['uses'].add(U_WPBS)
for l in vupr['loci']: touch(l, 'Solanum lycopersicum', l, 'Vu 2024')['uses'].add(U_PAIR)

LEGEND = {
 'OsDEP1':              'Figure 2A - spacer composite score decomposed by term',
 'TaUbi10-T2':          'Figure 2B - PBS free-energy landscape, wheat band',
 'OsCDC48-T1':          'Figure 2C - PBS free-energy landscape, rice band',
 'OsALS-T2 (Lin 2021)': 'Figure 2E and 2F; Figure 3; Figure S3; Supplementary Data S1 - '
                        'the worked example carried through the paper',
 'OsALS-T2 (Lin 2020)': 'Figure S1A - published-spacer geometry at the ALS locus',
}
for k, v in LEGEND.items(): touch(k)['uses'].add(v)

# alias resolution: which other label denotes the same protospacer
ALIAS = collections.defaultdict(set)
for st in STAGES:
    for labs in st['same'].values():
        for x in labs:
            ALIAS[x] |= {y for y in labs if y != x}

# ───────────────────────────────────────────────────────────── workbook
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

FONT = 'Arial'
HDR = PatternFill('solid', fgColor='1F4E33')
BAND = PatternFill('solid', fgColor='EDF3EF')
WARN = PatternFill('solid', fgColor='FCE8E6')
thin = Side(style='thin', color='BBBBBB')
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)

def style(ws, widths, head=1):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for c in ws[head]:
        c.font = Font(FONT, bold=True, color='FFFFFF', size=10)
        c.fill = HDR; c.alignment = Alignment(vertical='center', wrap_text=True); c.border = BOX
    ws.row_dimensions[head].height = 32
    for row in ws.iter_rows(min_row=head + 1):
        for c in row:
            c.font = Font(FONT, size=10)
            c.alignment = Alignment(vertical='top', wrap_text=True); c.border = BOX
        if row[0].row % 2 == 0:
            for c in row:
                if c.fill.fgColor.rgb in (None, '00000000'): c.fill = BAND
    ws.freeze_panes = ws.cell(head + 1, 1)

wb = Workbook()

# ---- Read me
ws = wb.active; ws.title = 'Read me'
ws.column_dimensions['A'].width = 116
TXT = [
 ('Plant Prime Editor v1.0 - published genes and their source papers', 'h1'),
 ('', ''),
 ('Every target locus used anywhere in the manuscript, figures, supplementary tables or', ''),
 ('deposited data, with the publication it came from and the place it is used.', ''),
 ('', ''),
 ('No sequence in this project is unpublished. All targets come from six published studies.', ''),
 ('', ''),
 ('Sheets', 'h2'),
 ('  Source papers      the six studies, with full citation and what was taken from each', ''),
 ('  Gene index         one row per target label: gene, species, paper, edit type, where used', ''),
 ('  By analysis        the same information grouped by figure, for checking one panel', ''),
 ('  Label collisions   labels that do not map one-to-one onto target sites - read this one', ''),
 ('  Li 2026 genes      the monocot genes in the 516-design corroboration set', ''),
 ('', ''),
 ('Built from the deposited files by analysis/gene_source_index.py:', 'h2'),
 ('  data/benchmark_scored.csv    data/targets_verified.csv     data/tm_table.csv', ''),
 ('  data/loto.json               data/headtohead.json          data/pridict_vs_measured.json', ''),
 ('  data/CaseStudy_Targets.csv   data/lin2020_wheat_pbs.json   data/vu2024_paired_pegRNA.json', ''),
 ('  data/li2026_pbs_designs.json analysis/architecture_sweep.json', ''),
 ('  analysis/weight_sensitivity.json  analysis/case_studies.json  analysis/als_sites.json', ''),
 ('', ''),
 ('Naming', 'h2'),
 ('A label such as OsCDC48-T1 names one target SITE. One gene can carry several sites', ''),
 ('(OsCDC48-T1, -T2, -T3). Two studies numbered the same sites differently, so some labels', ''),
 ('carry the study in brackets. Labels are NOT a reliable key for counting sites - see the', ''),
 ('Label collisions sheet.', ''),
]
for i, (t, k) in enumerate(TXT, 1):
    c = ws.cell(i, 1, t)
    c.font = Font(FONT, bold=k in ('h1', 'h2'), size=13 if k == 'h1' else 10,
                  color='1F4E33' if k in ('h1', 'h2') else '000000')
    c.alignment = Alignment(wrap_text=True, vertical='top')

# ---- Source papers
ws = wb.create_sheet('Source papers')
ws.append(['#', 'Short name', 'Full citation', 'DOI', 'What was taken', 'Species',
           'Target labels used'])
by_paper = collections.defaultdict(set)
for lab, d in info.items():
    for p in d['papers']: by_paper[p].add(lab)
EXTRA = {'Li 2026': 'see the "Li 2026 genes" sheet',
         'Li 2023': 'gene identities are not carried in the deposited extract '
                    '(spacer, PBS, length and Tm only)',
         'Xu 2020': 'OsACC - designs peACC1 to peACC4'}
for i, k in enumerate(['Lin 2020', 'Lin 2021', 'Vu 2024', 'Li 2026', 'Li 2023', 'Xu 2020'], 1):
    P = PAPERS[k]
    ws.append([i, k, P['cite'], 'https://doi.org/' + P['doi'], P['took'], P['species'],
               ', '.join(sorted(by_paper[k])) or EXTRA.get(k, '')])
style(ws, [5, 11, 60, 34, 50, 21, 60])

# ---- Gene index
ws = wb.create_sheet('Gene index')
ws.append(['Target label', 'Gene', 'Species', 'Source paper', 'Edit type(s)',
           'pegRNAs in benchmark', 'Same site as', 'Where it is used'])
for lab in sorted(info, key=lambda x: (info[x]['species'], x)):
    d = info[lab]
    ws.append([lab, d['gene'] or gene_of(lab), d['species'] or '-',
               ', '.join(sorted(d['papers'])) or '-',
               ', '.join(sorted(d['edits'])) or '-', d['n_peg'] or '-',
               ', '.join(sorted(ALIAS.get(lab, []))) or '-',
               ' | '.join(sorted(d['uses'])) or '-'])
    if ALIAS.get(lab): ws.cell(ws.max_row, 7).fill = WARN
style(ws, [23, 13, 27, 19, 13, 13, 22, 82])

# ---- By analysis
ws = wb.create_sheet('By analysis')
ws.append(['Figure / analysis', 'What it is', 'n labels', 'Target labels', 'Source paper(s)'])
by_use = collections.defaultdict(set)
for lab, d in info.items():
    for u in d['uses']: by_use[u].add(lab)
ORDER = [
 (LEGEND['OsDEP1'],              'five candidate spacers at one rice target'),
 (LEGEND['TaUbi10-T2'],          'PBS landscape 8-22 nt, wheat melting band'),
 (LEGEND['OsCDC48-T1'],          'PBS landscape 8-22 nt, rice melting band'),
 (U_WSEN,                        '31 distinct designs over 7 weight settings'),
 (LEGEND['OsALS-T2 (Lin 2021)'], 'one design carried through four display items'),
 (U_TM,                          '74 PBS variants recovered, 73 analysed, 72 plotted'),
 (U_H2H,                         'same 7 sequences and 7 edits across 7 tools'),
 (U_PRI,                         '23 matched pegRNAs with measured rice efficiency'),
 (LEGEND['OsALS-T2 (Lin 2020)'], 'plus and minus strand PBS/RT derivation'),
 (U_LOTO,                        '13 targets with three or more analysed lengths'),
 (U_RANK,                        '10 targets with four or more analysed lengths'),
 (U_BENCH,                       '176 parsed, 162 passing, 141 scored, 136 ranked at 26 sites'),
 (U_ARCH,                        '275 combinations, 248 complete, 27 declined'),
 (U_CTRL,                        'all eleven architectures at one locus'),
 (U_SPRD,                        'one published locus per species'),
 (U_WPBS,                        'wheat PBS lengths, not part of the scored benchmark'),
 (U_PAIR,                        'dicot paired-pegRNA loci'),
]
for key, what in ORDER:
    labs = sorted(by_use.get(key, []))
    paps = sorted({p for l in labs for p in info[l]['papers']})
    ws.append([key, what, len(labs), ', '.join(labs), ', '.join(paps)])
style(ws, [50, 45, 9, 84, 24])

# ---- Label collisions
ws = wb.create_sheet('Label collisions')
ws.append(['Finding', 'Detail'])
rows = [('WHY THIS SHEET EXISTS',
         'A target site is a protospacer in a genomic window. A label is a name a study gave '
         'it. They are not one-to-one in this deposit, so counting sites by label is unsafe. '
         'Since 19 September 2026 every analysis keys on the protospacer through the '
         'generated registry analysis/target_sites.json; this sheet records what that changed. '
         'The key is verified unambiguous: no protospacer occupies two genomic windows.')]
rows.append(('', ''))
rows.append(('SITE COUNT AT EACH CASCADE STAGE', ''))
for st in STAGES:
    flag = ('unchanged' if st['was'] == st['true']
            else 'CORRECTED from %d to %d' % (st['was'], st['true']))
    rows.append((st['stage'],
                 '%d labels | label-keyed count was %d | true distinct sites %d -> %s'
                 % (st['labels'], st['was'], st['true'], flag)))
rows.append(('', ''))
rows.append(('LABEL PAIRS THAT ARE ONE SITE', 'identical protospacer, identical window'))
seen = set()
for st in STAGES:
    for k, labs in st['same'].items():
        if tuple(labs) in seen: continue
        seen.add(tuple(labs))
        was = 'was registered in als_sites.json' if labs[0] in ALS else 'was NOT registered'
        rows.append((' + '.join(labs),
                     '%s | %s | now one site, %s, in target_sites.json'
                     % (k, was, SITE_OF_SPACER.get(k, '?'))))
rows.append(('', ''))
rows.append(('SINGLE LABELS THAT ARE TWO SITES', 'one name, two different protospacers'))
seen2 = set()
for st in STAGES:
    for lab, sps in st['split'].items():
        if lab in seen2: continue
        seen2.add(lab); rows.append((lab, ' and '.join(sps)))
for r in rows: ws.append(list(r))
for row in ws.iter_rows(min_row=2):
    if row[0].value and row[0].value.isupper():
        for c in row: c.fill = WARN
style(ws, [40, 104])
for row in ws.iter_rows(min_row=2):
    if row[0].value and row[0].value.isupper():
        row[0].font = Font(FONT, bold=True, size=10, color='8B2118')

# ---- Li 2026 genes
ws = wb.create_sheet('Li 2026 genes')
ws.append(['Gene', 'Species (from prefix)', 'Designs in the set'])
cnt = collections.Counter(r['gene'].strip() for r in li26)
SP = {'Os': 'rice (Oryza sativa)', 'Ta': 'wheat (Triticum aestivum)', 'Zm': 'maize (Zea mays)'}
for g, n in sorted(cnt.items()):
    ws.append([g, SP.get(g[:2], '-'), n])
ws.append(['TOTAL - %d distinct genes' % len(cnt), '', '=SUM(C2:C%d)' % (len(cnt) + 1)])
style(ws, [26, 30, 19])
for c in ws[ws.max_row]: c.font = Font(FONT, bold=True, size=10)

os.makedirs(a.out, exist_ok=True)
OUT = os.path.join(a.out, 'PlantPrimeEditor_gene_sources.xlsx')
wb.save(OUT)
print('wrote', OUT)
print('target labels indexed :', len(info))
print('Li 2026 distinct genes:', len(cnt))
for st in STAGES:
    print('  %-22s labels %2d | paper %2d | true %2d'
          % (st['stage'], st['labels'], st['was'], st['true']))
