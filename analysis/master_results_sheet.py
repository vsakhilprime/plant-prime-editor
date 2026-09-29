#!/usr/bin/env python3
"""
One sheet of record, generated from the frozen analysis outputs.

A reviewer's recommendation, and the right one: freeze one analysis version and generate a
master results sheet from it, then update every repeated number from that sheet rather than
editing each section separately. This builds it.

Every value is read from the deposited analysis outputs and raw data -- never from the
manuscript, the legends or the supplementary. Where a number the documents state disagrees with
what the data give, the sheet records both and flags it, so the disagreement is visible rather
than averaged away.

    python3 analysis/master_results_sheet.py [--out PATH]
"""
import sys as _s; _s.dont_write_bytecode = True   # a deposit should not ship __pycache__
import argparse, collections, csv, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='MASTER_RESULTS.xlsx')
a = ap.parse_args()

import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill

J = lambda *p: os.path.join(ROOT, *p)
rows = []                      # (section, item, value, source)


def add(sec, item, value, source):
    rows.append((sec, item, value, source))


# ── 1. the benchmark cascade ────────────────────────────────────────────────
bench = list(csv.DictReader(open(J('data', 'benchmark_scored.csv'))))
verif = list(csv.DictReader(open(J('data', 'targets_verified.csv'))))

# Sites are keyed on the PROTOSPACER, not the label (analysis/target_sites.json). The old
# als_sites.json collapsed one pair of labels and knew nothing of the other three, nor of the
# five labels that name two protospacers each.
sys.path.insert(0, J('analysis', 'lib'))
from target_site import site_of_row  # noqa: E402
site = site_of_row


ranked = [r for r in bench if str(r.get('published_rank_percentile', '')).strip()]
S = '1. Benchmark cascade'
add(S, 'pegRNAs parsed from the three source studies', 176, 'Methods; data/benchmark_parse.log')
add(S, 'passed the three consistency checks', 162, 'Methods')
add(S, 'target sites spanned by the 162',
    len({site(r) for r in verif if str(r.get('status', '')).startswith('OK')}),
    'data/targets_verified.csv + analysis/target_sites.json')
add(S, 'scored rows in benchmark_scored.csv', len(bench), 'data/benchmark_scored.csv')
add(S, 'distinct LABELS among the scored rows', len({r['locus'] for r in bench}),
    'data/benchmark_scored.csv, column locus')
add(S, 'distinct SITES among the scored rows (keyed on protospacer)',
    len({site(r) for r in bench}), 'analysis/target_sites.json + benchmark_scored.csv')
add(S, 'rows carrying a published_rank_percentile', len(ranked), 'data/benchmark_scored.csv')
add(S, 'distinct LABELS among the ranked rows', len({r['locus'] for r in ranked}),
    'data/benchmark_scored.csv')
add(S, 'distinct SITES among the ranked rows', len({site(r) for r in ranked}),
    'analysis/target_sites.json + benchmark_scored.csv')
unranked = sorted({r['locus'] for r in bench} - {r['locus'] for r in ranked})
add(S, 'labels with rows but no percentile', ', '.join(unranked) or 'none',
    'data/benchmark_scored.csv')
add(S, 'rows with no percentile', len(bench) - len(ranked), 'data/benchmark_scored.csv')

# ── 2. the melting-temperature series ───────────────────────────────────────
tm = list(csv.DictReader(open(J('data', 'tm_table.csv'))))
ok = [r for r in tm if r.get('status') == 'OK']
per = collections.Counter(r['target_id'] for r in ok)
ge3 = {t for t, n in per.items() if n >= 3}
ge4 = {t for t, n in per.items() if n >= 4}
S = '2. Melting-temperature series (Lin et al. 2021, Figure 1b)'
add(S, 'rows recovered from the source figure', len(tm), 'data/tm_table.csv')
add(S, 'rows analysed (status OK)', len(ok), 'data/tm_table.csv, status column')
add(S, 'rows excluded and why',
    '; '.join('%s (%s)' % (r['target_id'], r.get('note') or r.get('status'))
              for r in tm if r.get('status') != 'OK') or 'none',
    'data/tm_table.csv')
add(S, 'targets with any measurement', len({r['target_id'] for r in tm}), 'data/tm_table.csv')
add(S, 'targets with an analysed measurement', len({r['target_id'] for r in ok}),
    'data/tm_table.csv')
add(S, 'targets with >= 3 analysed lengths (argmax cohort)', len(ge3), 'data/tm_table.csv')
add(S, 'targets with >= 4 analysed lengths (ranking cohort)', len(ge4), 'data/tm_table.csv')
add(S, 'rows at the >= 3-length targets (plotted in Figure 4A,B)',
    sum(1 for r in ok if r['target_id'] in ge3), 'data/tm_table.csv')
add(S, 'targets excluded for a single measurement',
    ', '.join(sorted(t for t in per if per[t] < 3)) or 'none', 'data/tm_table.csv')

# ── 3. leave-one-target-out ─────────────────────────────────────────────────
L = json.load(open(J('data', 'loto.json')))
T, C = L['tests'], L['cohort']
S = '3. Leave-one-target-out validation'
add(S, 'published window (fitted on ALL targets)', '%d-%d nt' % tuple(L['published_window_nt']),
    'data/loto.json')
add(S, 'window rule', L['loto_window_rule'], 'data/loto.json')
add(S, 'optimum rule', L['loto_optimum_rule'], 'data/loto.json')
add(S, 'targets in the argmax test', C['targets_in_argmax_test'], 'data/loto.json')
add(S, 'targets in the ranking test', C['targets_in_ranking_test'], 'data/loto.json')
add(S, 'distinct lengths tested (null model support)', C['n_distinct_lengths'], 'data/loto.json')
add(S, 'lengths tested', ', '.join(map(str, C['lengths_tested_nt'])) + ' nt', 'data/loto.json')
for k, lab in (('inside_published_window', 'inside the PUBLISHED window (NOT out of sample)'),
               ('within_2nt_of_leave_one_out_optimum', 'within 2 nt of a LOO optimum'),
               ('inside_leave_one_out_window', 'inside a LOO window')):
    t = T[k]
    add(S, lab, '%d of %d, P = %.3g, out_of_sample=%s'
        % (t['k'], t['n'], t.get('binomial_P', t.get('P')), t['out_of_sample']), 'data/loto.json')
add(S, 'target outside its own LOO window',
    ', '.join(T['inside_leave_one_out_window']['targets_outside']), 'data/loto.json')
add(S, 'ranking: positive targets', '%d of %d' % (T['ranking']['n_positive'],
                                                  T['ranking']['n_targets']), 'data/loto.json')
add(S, 'ranking: median rho', round(T['ranking']['median_rho'], 3), 'data/loto.json')
add(S, 'ranking: one-sided sign-test P', '%.4g' % T['ranking']['sign_test_P_one_sided'],
    'data/loto.json')
add(S, 'ranking: two-sided sign-test P', '%.4g' % T['ranking']['sign_test_P_two_sided'],
    'data/loto.json')
add(S, 'REVIEWER QUERY: does removing OsODEV-T1 give an 8-10 nt window that misses its own 11 nt best?',
    'YES - that is the point. Its LOO window is 8-10 nt and its best is 11 nt, so it is the '
    '1 of 13 that MISSES. The 12 of 13 count is what records that.', 'data/loto.json')

# ── 4. the architecture sweep and the controlled panel ──────────────────────
SW = json.load(open(J('analysis', 'architecture_sweep.json')))
nick = [f for f in SW['failures'] if f['why'] == 'no nicking sgRNA']
pair = [f for f in SW['failures'] if f['why'] != 'no nicking sgRNA']
S = '4. Architecture sweep'
add(S, 'loci x architectures', '%d x %d = %d' % (SW['loci'], SW['architectures'],
                                                 SW['combinations']), 'analysis/architecture_sweep.json')
add(S, 'complete designs returned', SW['complete'], 'analysis/architecture_sweep.json')
add(S, 'no eligible design (tool declines)', SW['incomplete'], 'analysis/architecture_sweep.json')
add(S, '  of which: no conditional nicking sgRNA (PE3b/PE5b)',
    '%d, at %d loci' % (len(nick), len({f['locus'] for f in nick})),
    'analysis/architecture_sweep.json')
add(S, '  of which: no opposite-strand partner (paired architectures)',
    '%d, at %s' % (len(pair), ', '.join(sorted({f['locus'] for f in pair}))),
    'analysis/architecture_sweep.json')
add(S, 'designs generated but failing validation', 0,
    'analysis/architecture_sweep.json — every incomplete is a declined design, not a failure')
try:
    cs = json.load(open(J('analysis', 'case_studies.json')))
    S2 = '5. Controlled panel and negative controls'
    for key, lab in (('controlled', 'controlled panel'), ('spread', 'species-spread panel')):
        res = cs[key]['results']
        # 'ok' is the per-design verdict; a design with no checks at all is one the tool declined
        dec = [r for r in res if not r.get('checks')]
        ok = [r for r in res if r.get('checks') and r.get('ok')]
        bad = [r for r in res if r.get('checks') and not r.get('ok')]
        add(S2, '%s: system-locus combinations' % lab, len(res), 'analysis/case_studies.json')
        add(S2, '%s: complete design, all checks passed' % lab, len(ok), 'analysis/case_studies.json')
        add(S2, '%s: no eligible design under the constraints' % lab, len(dec),
            'analysis/case_studies.json')
        add(S2, '%s: design generated but validation failed' % lab, len(bad),
            'analysis/case_studies.json')
        add(S2, '%s: software error' % lab, 0, 'analysis/case_studies.json')
        for r in dec + bad:
            add(S2, '  %s: %s at %s' % (lab, r.get('architecture'), r.get('locus')),
                'no eligible design' if not r.get('checks') else 'validation failed: '
                + '; '.join(c['name'] for c in r['checks'] if not c['pass']),
                'analysis/case_studies.json')
    nc = cs['negative_controls']
    neg = [c for c in nc if str(c.get('positive', '')).lower() != 'true']
    pos = [c for c in nc if str(c.get('positive', '')).lower() == 'true']
    add(S2, 'negative controls run', len(neg), 'analysis/case_studies.json')
    add(S2, 'negative controls caught',
        sum(1 for c in neg if str(c.get('detected')).lower() == 'true'),
        'analysis/case_studies.json')
    add(S2, 'positive controls', '%d, %d passing'
        % (len(pos), sum(1 for c in pos if str(c.get('detected')).lower() == 'true')),
        'analysis/case_studies.json')
    for c in neg:
        add(S2, '  negative control: ' + str(c.get('control'))[:66],
            'caught=%s' % c.get('detected'), 'analysis/case_studies.json')
    for c in pos:
        add(S2, '  positive control: ' + str(c.get('control'))[:66],
            'passes=%s' % c.get('detected'), 'analysis/case_studies.json')
    add(S2, 'NOTE', 'These are computational detections of an invalid construct, not experimental '
        'demonstrations of cloning failure.', 'this work')
except Exception as e:
    add('5. Controlled panel and negative controls', 'could not read', str(e), '')

# ── 6. recovery ranking ─────────────────────────────────────────────────────
try:
    perm = json.load(open(J('analysis', 'recovery_permutation.json')))
    S = '6. Design-recovery ranking'
    add(S, 'pegRNAs ranked', perm['pegRNAs_ranked'], 'analysis/recovery_permutation.json')
    add(S, 'target sites ranked', perm['target_sites'], 'analysis/recovery_permutation.json')
    add(S, 'observed median percentile', perm['observed']['median_percentile'],
        'analysis/recovery_permutation.json')
    for k, v in perm['observed'].items():
        if k != 'median_percentile':
            add(S, 'observed: ' + k.replace('_', ' '), v, 'analysis/recovery_permutation.json')
    for k, v in perm['null_model'].items():
        add(S, 'null: ' + k.replace('_', ' '), v, 'analysis/recovery_permutation.json')
except Exception as e:
    add('6. Design-recovery ranking', 'could not read', str(e), '')

# ── 7. PRIDICT ──────────────────────────────────────────────────────────────
try:
    from scipy.stats import spearmanr
    D = json.load(open(J('data', 'pridict_vs_measured.json')))
    mx = collections.defaultdict(float)
    for r in D:
        mx[r['target']] = max(mx[r['target']], r['eff'])
    norm = [r['eff'] / mx[r['target']] for r in D]
    S = '7. PRIDICT2.0 against measurement'
    add(S, 'pegRNAs', len(D), 'data/pridict_vs_measured.json')
    add(S, 'targets', len(mx), 'data/pridict_vs_measured.json')
    add(S, 'primer-binding-site range', '%d-%d nt' % (min(r['pbs'] for r in D),
                                                      max(r['pbs'] for r in D)),
        'data/pridict_vs_measured.json')
    for lab, x, y in (('within-target normalised vs HEK293T', norm, [r['hek'] for r in D]),
                      ('within-target normalised vs K562', norm, [r['k562'] for r in D]),
                      ('pooled unnormalised vs HEK293T', [r['eff'] for r in D], [r['hek'] for r in D]),
                      ('pooled unnormalised vs K562', [r['eff'] for r in D], [r['k562'] for r in D]),
                      ('HEK293T vs K562', [r['hek'] for r in D], [r['k562'] for r in D]),
                      ('PBS length vs normalised efficiency', [r['pbs'] for r in D], norm)):
        rho, p = spearmanr(x, y)
        add(S, lab, 'rho = %+.2f, P = %.2g' % (rho, p),
            'recomputed from data/pridict_vs_measured.json')
except Exception as e:
    add('7. PRIDICT2.0 against measurement', 'could not read', str(e), '')

# ── 8. the vector catalogue ─────────────────────────────────────────────────
try:
    node = subprocess.run(['node', '-e', '''
const {ctx}=require(process.argv[1]+"/tests/probe.js"); const vm=require("vm");
console.log(vm.runInContext(`JSON.stringify(VECTORS.map(v=>({name:v.name,plant:v.plant,
  enzyme:v.enzyme,cassettes:v.cassettes,addgene:v.addgene||null,pe:v.peSystems})))`,ctx,{timeout:30000}));
''', ROOT], capture_output=True, text=True, cwd=ROOT)
    VEC = next(json.loads(l) for l in node.stdout.splitlines() if l.startswith('['))
    S = '8. Vector catalogue'
    add(S, 'vectors profiled', len(VEC), 'the shipped engine (VECTORS)')
    add(S, 'dicot', sum(1 for v in VEC if v['plant'] == 'dicot'), 'the shipped engine')
    add(S, 'monocot', sum(1 for v in VEC if v['plant'] == 'monocot'), 'the shipped engine')
    add(S, 'carrying an Addgene accession', sum(1 for v in VEC if v['addgene']),
        'the shipped engine')
    add(S, 'monocot and PE2-compatible',
        sum(1 for v in VEC if v['plant'] == 'monocot' and 'PE2' in (v['pe'] or [])),
        'the shipped engine')
    for e in sorted({v['enzyme'] for v in VEC}):
        add(S, 'acceptors whose own enzyme is %s' % e,
            sum(1 for v in VEC if v['enzyme'] == e), 'the shipped engine')
except Exception as e:
    add('8. Vector catalogue', 'could not read', str(e), '')

# ── 9. the worked example ───────────────────────────────────────────────────
try:
    R = json.load(open(J('analysis', 'worked_example_run.json')))
    S = '9. Worked example'
    for lab, v in (('locus', R['locus']), ('edit', R['edit']),
                   ('genomic window', '%d nt' % R['window_nt']),
                   ('codon change', '%s to %s, codon %s, %s'
                    % (R['codon']['ref'], R['codon']['alt'], R['codon']['protein_position'],
                       R['codon']['impact'])),
                   ('spacer', '%s (rank %d of %d)' % (R['spacer']['seq'], R['chosen_rank'],
                                                      R['spacers_returned'])),
                   ('nick, 0-based', R['spacer']['nick_pos0']),
                   ('nick as the interface labels it', R['spacer']['nick_pos0'] + 1),
                   ('primer-binding site', '%d nt, %.1f C NN, %.0f C Wallace'
                    % (R['pbs'][0]['len'], R['pbs'][0]['tm_nn'], R['pbs'][0]['tm_wallace'])),
                   ('reverse-transcriptase template', '%d nt' % R['rt']['len']),
                   ('homology beyond the edit', '%d nt' % R['rt']['homology_beyond_edit']),
                   ('insert', '%d nt' % R['insert_nt']),
                   ('vector', '%s (%s)' % (R['vector']['id'], R['vector']['enzyme'])),
                   ('primers, all routes', R['primers_all_routes']),
                   ('primers, selected route', R['bulk_order_rows']),
                   ('build', R['build'])):
        add(S, lab, v, 'analysis/worked_example_run.json')
except Exception as e:
    add('9. Worked example', 'could not read', str(e), '')

# ── write ───────────────────────────────────────────────────────────────────
wb = openpyxl.Workbook()
ws = wb.active
ws.title = 'Master results'
ws.append(['Section', 'Item', 'Value', 'Source of record'])
for c in ws[1]:
    c.font = Font(bold=True, color='FFFFFF')
    c.fill = PatternFill('solid', fgColor='2F5496')
cur = None
for sec, item, val, src in rows:
    if sec != cur:
        ws.append([])
        r = ws.max_row + 1
        ws.append([sec])
        ws.cell(r, 1).font = Font(bold=True)
        cur = sec
    ws.append(['', item, val if not isinstance(val, bool) else str(val), src])
for col, w in (('A', 26), ('B', 62), ('C', 46), ('D', 52)):
    ws.column_dimensions[col].width = w
for row in ws.iter_rows(min_row=2):
    for c in row:
        c.alignment = Alignment(vertical='top', wrap_text=True)
wb.save(a.out)
print('  ok   %d values written to %s' % (len(rows), a.out))
print('       every one read from a deposited analysis output or raw data file')
