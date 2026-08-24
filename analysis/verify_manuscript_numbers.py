#!/usr/bin/env python3
"""
Plant Prime Editor — regenerate every headline number in the manuscript from deposited data.

Three numbers in this manuscript have already been found not to match the data behind them,
each discovered by accident while doing something else. With 928 numeric tokens in the text
that is not a sustainable way to find them. This regenerates the claims that can be
regenerated, prints the manuscript value beside the computed one, and marks any disagreement.

    python3 analysis/verify_manuscript_numbers.py
"""
import csv, json, os, collections, statistics as st

HERE = os.path.dirname(os.path.abspath(__file__))
D = lambda *p: os.path.join(HERE, '..', 'data', *p)
A = lambda *p: os.path.join(HERE, *p)

def rows(p):
    with open(p, newline='', encoding='utf-8-sig') as fh:
        return list(csv.DictReader(fh))
def num(x):
    try: return float(str(x).strip())
    except Exception: return None

checks = []
# The number of checks this script is expected to make. It is asserted at the end.
# Without it, a missing data file or a failed regex silently removes checks and the
# script still reports "0 disagree" — which is how it behaved until 23 Aug 2026.
EXPECTED_CHECKS = 68
def chk(claim, stated, computed, note=''):
    ok = (str(stated) == str(computed))
    checks.append((ok, claim, stated, computed, note))

# ── benchmark cohort ──────────────────────────────────────────────────────
bench = rows(D('benchmark_scored.csv'))
rw    = rows(D('scored_rice_wheat.csv'))
tom   = rows(D('scored_tomato.csv'))
merge = json.load(open(A('benchmark_merge.json')))

chk('merged benchmark: pegRNAs',            141, len(bench))
chk('merged benchmark: target sites',       26,  len({r['locus'] for r in bench}))
chk('merged benchmark: carrying a rank',    135, sum(1 for r in bench if str(r.get('published_rank_percentile','')).strip()))
chk('merge record agrees with the file',    len(bench), merge['pegRNAs'])
chk('rice/wheat pass rows',                 134, len(rw))
chk('tomato pass rows',                     7,   len(tom))
chk('two passes sum to the merged file',    len(bench), len(rw)+len(tom))

# ── design recovery ───────────────────────────────────────────────────────
pcts = [num(r['published_rank_percentile']) for r in bench if num(r.get('published_rank_percentile')) is not None]
chk('recovery: n ranked',                   135, len(pcts))
chk('recovery: median percentile',          92.3, round(st.median(pcts),1))
chk('recovery: fraction in the top decile', 56,   round(100*sum(1 for p in pcts if p>=90)/len(pcts)))
chk('recovery: lowest percentile observed', 33.3, round(min(pcts),1))
chk('recovery: one below the 50th (TaGASR7-peg01, a 4-candidate site)', 1, sum(1 for p in pcts if p<50))

perm = json.load(open(A('recovery_permutation.json')))
chk('permutation: null median',             57.1, perm['null_model']['null_median_of_medians'])
chk('permutation: null 95th percentile',    64.3, perm['null_model']['null_95th_percentile'])
chk('permutation: observed median',         92.3, perm['observed']['median_percentile'])

# ── melting-temperature window ────────────────────────────────────────────
tm = rows(D('tm_table.csv'))
chk('Tm series: measurements',              74, len(tm))
chk('Tm series: rice target sites',         14, len({r['target_id'] for r in tm}))

win = json.load(open(A('window_sensitivity.json')))
rc  = win['rule_comparison']
chk('window: targets with 3+ lengths',      13, win['n_targets_with_3plus_lengths'])
chk('window: best length inside 8-11 nt',   13, rc['targets_whose_best_length_is_inside_the_new_window'])
chk('superseded 11-15 nt rule captures',    1,  rc['targets_whose_best_length_is_inside_the_old_rule'])

# ── leave-one-target-out ──────────────────────────────────────────────────
# data/loto.json has no generator in this deposit: it is the recorded output of the
# leave-one-target-out analysis, held as data rather than recomputed here. Guarded the
# same way as the three blocks below so a missing file gives a message rather than a
# traceback — and, because the guard would otherwise let five checks disappear quietly,
# the EXPECTED_CHECKS assertion at the end catches that too.
try:
    loto = json.load(open(D('loto.json')))
except FileNotFoundError:
    print('   (leave-one-target-out not checked: data/loto.json is missing)')
    loto = None
arg  = loto['argmax'] if loto else []
if loto:
    inside = sum(1 for _t, obs, _pred, _n in arg if 8 <= obs <= 11)
    chk('LOTO: withheld best inside the window', 13, inside, '%d targets in the argmax test' % len(arg))
    rank = loto['ranking']
    chk('LOTO: targets in the ranking test',     11, len(rank))
    chk('LOTO: median rho',                      0.74, round(st.median([r[1] for r in rank]), 2))
    chk('LOTO: positive at every target',        11, sum(1 for r in rank if r[1] > 0))
    chk('LOTO: pooled n',                        67, sum(r[2] for r in rank))

# ── score vs efficiency between sites ─────────────────────────────────────
lin = rows(D('benchmark_lin2020_joined.csv'))
usable = [r for r in lin if num(r.get('composite_score')) is not None and num(r.get('measured_efficiency')) is not None]
chk('between-site test: pegRNAs',            44, len(usable))
chk('between-site test: target sites',       12, len({r['target'] for r in usable}))
chk('between-site test: combinations',       15, len({(r['target'], r['edit']) for r in usable}))

# ── paired pegRNAs in tomato ──────────────────────────────────────────────
vu = json.load(open(D('vu2024_paired_pegRNA.json')))
claimed = {'SlALS1': (6.19, 5.38), 'SlCENH3': (1.02, 0.70), 'SlEPSPS1': (2.48, 2.46)}
for loc, (cp, cs) in claimed.items():
    g = vu['loci'][loc]
    chk('tomato pairing: %s pair' % loc,           cp, round(g['mean_pair'], 2))
    chk('tomato pairing: %s better single' % loc,  cs, round(g['mean_better_single'], 2))
    chk('tomato pairing: %s pair wins' % loc,      True, g['pair_exceeds_better_single'])

# ── recovery percentile, stated as a "top X%" ─────────────────────────────
# 100 - 92.3 is exactly 7.7, so the text states the top 7.7% directly and there is no
# banker's rounding. Stating the percentile itself avoids the ambiguity entirely.
chk('recovery: median is the 92.3rd percentile', 92.3, round(st.median(pcts), 1),
    'stated in the text as "top 7.7%"; 100-92.3 = 7.7 exactly')

# ── Figure 4 Gaussian fit — added 14 Aug 2026 ─────────────────────────────
# These sit in the Methods and the Figure 4 legend and were NOT covered by the
# original 38 checks; the manuscript said 29.4 C / R2 0.46 while the seeded,
# deterministic fit gives 29.6 C / R2 0.446. Locked so they cannot drift.
try:
    import subprocess as _sp, os as _os, re as _re2
    _out = _sp.run(['python3', _os.path.join(HERE, 'fit_tm_optimum.py')],
                   cwd=_os.path.join(HERE, '..', 'data'),
                   capture_output=True, text=True, timeout=300).stdout
    _w = _re2.search(r'Wallace \(Lin 2021\).*?optimum Tm\s+([\d.]+)', _out, _re2.S)
    _r = _re2.search(r'Wallace \(Lin 2021\).*?R.\s+([\d.]+)', _out, _re2.S)
    # A regex miss used to drop both checks with no message. Record the miss as a
    # disagreement instead: a check that cannot run is not a check that passed.
    chk('Figure 4: Wallace optimum (C)', 29.6,
        round(float(_w.group(1)), 1) if _w else 'NOT FOUND in fit_tm_optimum.py output')
    chk('Figure 4: Wallace R-squared', 0.45,
        round(float(_r.group(1)), 2) if _r else 'NOT FOUND in fit_tm_optimum.py output')
except Exception as _e:
    print('   (Figure 4 fit not re-run: %s)' % _e)
    chk('Figure 4: Wallace optimum (C)', 29.6, 'fit did not run')
    chk('Figure 4: Wallace R-squared', 0.45, 'fit did not run')

# ── Figure 6, PRIDICT2.0 against measurement — added 17 Aug 2026 ──────────
# Figure 6 was the one display item with no check here at all, and its source
# table was not in the deposit: the numbers lived only in the Results prose and
# in Supplementary Table S10. data/pridict_vs_measured.json is now that table in
# machine-readable form.
#
# CONVENTION, and it matters: the measured efficiency is normalised within each
# target to that target's own maximum, exactly as the Figure 6B legend states.
# On raw pooled efficiency the headline correlation is +0.11, P = 0.60 — the
# opposite sign — because between-target differences in absolute editability
# swamp the within-target trend. A reader recomputing this without normalising
# will not reproduce the paper, so the normalisation is applied here explicitly.
try:
    from scipy.stats import spearmanr as _sp2
    _p = json.load(open(D('pridict_vs_measured.json')))
    _tg = [r['target'] for r in _p]
    _mx = {}
    for r in _p: _mx[r['target']] = max(_mx.get(r['target'], 0), r['eff'])
    _eff = [r['eff'] / _mx[r['target']] for r in _p]      # normalised within target
    _hek = [r['hek'] for r in _p]
    _k56 = [r['k562'] for r in _p]
    _pbs = [r['pbs'] for r in _p]

    chk('Figure 6: matched pegRNAs',        23, len(_p))
    chk('Figure 6: rice targets',            4, len(set(_tg)))
    chk('Figure 6: PBS range low (nt)',      7, min(_pbs))
    chk('Figure 6: PBS range high (nt)',    15, max(_pbs),
        'text says "the 7-15 nt range these experiments cover"')

    _r1, _p1 = _sp2(_hek, _eff)
    chk('Figure 6: rho HEK293T vs measured',  -0.49, round(_r1, 2))
    chk('Figure 6: P HEK293T vs measured',    0.019, round(_p1, 3))
    _r2, _p2 = _sp2(_k56, _eff)
    chk('Figure 6: rho K562 vs measured',     -0.28, round(_r2, 2))
    chk('Figure 6: P K562 vs measured',        0.20, round(_p2, 2))
    _r3, _p3 = _sp2(_eff, _pbs)
    chk('Figure 6: rho efficiency vs PBS',    -0.68, round(_r3, 2))
    chk('Figure 6: P efficiency vs PBS',     0.0004, round(_p3, 4))
    chk('Figure 6: rho HEK vs K562',          +0.86, round(_sp2(_hek, _k56)[0], 2))

    # Panel A: the length PRIDICT scores highest against the length that won.
    _claim = {'OsAAT': (12, 8), 'OsACC-T1': (14, 9), 'OsALS-T2': (12, 8), 'OsEPSPS-T1': (10, 8)}
    for _t, (_cp, _cb) in sorted(_claim.items()):
        _rows = [r for r in _p if r['target'] == _t]
        _top = max(_rows, key=lambda r: r['hek'])['pbs']
        _best = max(_rows, key=lambda r: r['eff'])['pbs']
        chk('Figure 6A: %s PRIDICT-top (nt)' % _t,  _cp, _top)
        chk('Figure 6A: %s best measured (nt)' % _t, _cb, _best)
except Exception as _e:
    print('   (Figure 6 checks not run: %s)' % _e)

# ── Benchmark parse cascade — added 21 Aug 2026 ───────────────────────────
# The Methods state a cascade from the raw parse down to the scored set, and
# none of it was checked here: the deposit's data/targets_verified.csv is the
# 176-row parse the Methods describe, but no check ever read it. Three of the
# stated numbers were wrong as a result. The manuscript said "154 carried a
# published primer-binding-site sequence, of which 148 reconstructions matched
# exactly"; the file gives 148 carrying a sequence and 144 matching, the other
# four being rows whose published table entry was truncated in the PDF and were
# reconstructed from the genome. It also said Lin 2020 contributed 87 pegRNAs at
# 17 target sites; the parse gives 86 at 16. Locked here so they cannot drift.
try:
    _tv = rows(D('targets_verified.csv'))
    _ok = [r for r in _tv if r['status'].startswith('OK')]
    _src = {}
    for r in _tv: _src[r['source_tbl']] = _src.get(r['source_tbl'], 0) + 1
    _t20 = {r['target_id'] for r in _tv if r['source_tbl'] == 'Lin2020_S1'}
    _t21 = {r['target_id'] for r in _tv if r['source_tbl'] == 'Lin2021_S1'}

    chk('benchmark parse: pegRNAs parsed',        176, len(_tv))
    chk('benchmark parse: passed the checks',     162, len(_ok))
    chk('benchmark parse: carrying a PBS',        148, sum(1 for r in _ok if r['pbs_seq'].strip()))
    chk('benchmark parse: PBS reconstructions matching',
                                                  144, sum(1 for r in _ok if r['pbs_check'].strip() == 'match'))
    chk('benchmark parse: target sites among the 162',
                                                   33, len({r['target_id'] for r in _ok}))
    chk('benchmark parse: Lin 2020 pegRNAs',       86, _src.get('Lin2020_S1'))
    chk('benchmark parse: Lin 2020 target sites',  16, len(_t20))
    chk('benchmark parse: Lin 2021 pegRNAs',       75, _src.get('Lin2021_S1'))
    chk('benchmark parse: Lin 2021 target sites',  14, len(_t21))
except Exception as _e:
    print('   (benchmark parse checks not run: %s)' % _e)

# ── report ────────────────────────────────────────────────────────────────
# This block must stay LAST. It was previously above the Figure 4 section, so
# those two checks were counted in the total but never compared against `bad`
# and never printed: a disagreement there would have been reported as
# "42 checks, 0 disagree". Anything added after this point is invisible.
bad = [c for c in checks if not c[0]]
print('\nMANUSCRIPT NUMBERS REGENERATED FROM DEPOSITED DATA\n')
print('  %-42s %10s %10s' % ('claim', 'manuscript', 'computed'))
for ok, claim, stated, computed, note in checks:
    print('  %s %-40s %10s %10s %s' % ('  ' if ok else '!!', claim, stated, computed, note))

print('\n  %d checks, %d disagree' % (len(checks), len(bad)))
if bad:
    print('\n  DISAGREEMENTS')
    for _ok, claim, stated, computed, note in bad:
        print('    %s : manuscript says %s, data gives %s %s' % (claim, stated, computed, note))

# A count short of EXPECTED_CHECKS means checks went missing, not that they passed.
short = len(checks) != EXPECTED_CHECKS
if short:
    print('\n  CHECK COUNT WRONG: expected %d, ran %d. Some check did not run — a data file'
          % (EXPECTED_CHECKS, len(checks)))
    print('  is missing, or a parse failed. "0 disagree" over an incomplete set means nothing.')

import sys
sys.exit(1 if (bad or short) else 0)
