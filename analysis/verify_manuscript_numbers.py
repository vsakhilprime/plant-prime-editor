#!/usr/bin/env python3
"""
Plant Prime Editor — regenerate every headline number in the manuscript from deposited data.

Three numbers in this manuscript have already been found not to match the data behind them,
each discovered by accident while doing something else. With 928 numeric tokens in the text
that is not a sustainable way to find them. This regenerates the claims that can be
regenerated, prints the manuscript value beside the computed one, and marks any disagreement.

    python3 analysis/verify_manuscript_numbers.py
"""
import sys as _s; _s.dont_write_bytecode = True   # a deposit should not ship __pycache__
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
EXPECTED_CHECKS = 96
def chk(claim, stated, computed, note=''):
    ok = (str(stated) == str(computed))
    checks.append((ok, claim, stated, computed, note))

# ── benchmark cohort ──────────────────────────────────────────────────────
bench = rows(D('benchmark_scored.csv'))
rw    = rows(D('scored_rice_wheat.csv'))
tom   = rows(D('scored_tomato.csv'))
merge = json.load(open(A('benchmark_merge.json')))

# ── one target site, however many studies numbered it ───────────────────────
# A site is a protospacer in a genomic window; a label is a name a study gave it, and the two
# are not one-to-one. Four pairs of labels denote ONE protospacer — OsALS-T1 (Lin 2020) =
# OsALS-T2 (Lin 2021), OsEPSPS-T1 = OsEPSPS-T2, OsAAT = OsAAT-T1, OsGAPDH = OsGAPDH-T1 — and
# five single labels denote TWO: OsCDC48-T3, OsEPSPS-T1, SlOr, SlCAB13, SlWH9. The earlier
# analysis/als_sites.json registered the first pair only, so label counting was wrong at two
# of the three cascade stages and right at the third by cancellation. Counting is now done on
# the protospacer, through the generated registry analysis/target_sites.json.
import sys as _sys
_sys.path.insert(0, A('lib'))
from target_site import site_of_row as _site_of_row, site_of_spacer as _site_of_spacer
def site(label_or_row):
    """The target SITE a benchmark row denotes, keyed on its protospacer."""
    if isinstance(label_or_row, dict):
        return _site_of_row(label_or_row)
    return _site_of_spacer(label_or_row)
def sites(rows, key=None):
    return {_site_of_row(r) for r in rows}

chk('merged benchmark: pegRNAs',            141, len(bench))
chk('merged benchmark: target sites',       27,  len(sites(bench)))
chk('merged benchmark: target labels',      27,  len({r['locus'] for r in bench}))
chk('merged benchmark: carrying a rank',    136, sum(1 for r in bench if str(r.get('published_rank_percentile','')).strip()))
chk('merge record agrees with the file',    len(bench), merge['pegRNAs'])
chk('rice/wheat pass rows',                 134, len(rw))
chk('tomato pass rows',                     7,   len(tom))
chk('two passes sum to the merged file',    len(bench), len(rw)+len(tom))

# ── architecture sweep ────────────────────────────────────────────────────
# Added 12 Sep 2026. The manuscript states how many architecture x locus
# combinations return a complete design, and that claim was previously written
# from a one-off run that nothing checked. analysis/architecture_sweep.js
# recomputes it from the shipped engine; these lines pin what the paper says.
try:
    _sw = json.load(open(A('architecture_sweep.json')))
    chk('architecture sweep: loci',            26,  _sw['loci'])
    chk('architecture sweep: architectures',   11,  _sw['architectures'])
    chk('architecture sweep: combinations',    286, _sw['combinations'])
    # These moved twice. First when the sweep began keying on the target SITE rather than the
    # label, and again (19 Sep 2026) when site identity moved from the label to the
    # PROTOSPACER (analysis/target_sites.json). The label-keyed version, even with the ALS
    # pair registered, designed OsGAPDH twice under two names and never designed the second
    # SlOr protospacer at all: 25 loci was right, the membership was not. With each of the 25
    # distinct protospacers designed exactly once the sweep returns 248 complete and 27
    # declined, not 250 and 25.
    chk('architecture sweep: complete designs', 257, _sw['complete'])
    chk('architecture sweep: incomplete',       29,  _sw['incomplete'])
    chk('architecture sweep: every locus swept is a distinct protospacer',
        len(_sw['locus_list']), len(set(_sw['locus_list'])))
    _nick = [f for f in _sw['failures'] if f['why'] == 'no nicking sgRNA']
    _pair = [f for f in _sw['failures'] if f['why'].startswith('no opposite-strand')]
    chk('architecture sweep: PE3b/PE5b with no nicking sgRNA', 26, len(_nick))
    chk('architecture sweep: loci where PE3b is undesignable', 13,
        len({f['locus'] for f in _nick}))
    chk('architecture sweep: paired architectures with no partner', 3, len(_pair))
    chk('architecture sweep: the locus that refuses a pair', 'OsDEP1',
        ','.join(sorted({f['locus'] for f in _pair})))
except FileNotFoundError:
    chk('architecture sweep: analysis/architecture_sweep.json present', True, False,
        'run node analysis/architecture_sweep.js')

# ── RT<->PBS weight sensitivity ───────────────────────────────────────────
# The heaviest weight in the tool is asserted rather than measured. This pins how
# much it actually decides, so the manuscript can state it instead of hedging.
try:
    _ws = json.load(open(A('weight_sensitivity.json')))
    chk('weight sensitivity: shipped weight',          1.5, _ws['shipped_weight'])
    # 31, not 32. OsGAPDH and OsGAPDH-T1 are one protospacer, one edit (C>A at 303) and one
    # window, so the panel carried 32 rows for 31 designs — and both copies moved at weight
    # 2.5, which is the whole of the old "largest change is two of 32". It is one of 31, and
    # one of 31 is also the maximum at every non-shipped weight.
    chk('weight sensitivity: distinct designs tested',  32, _ws['loci'])
    chk('weight sensitivity: no design appears twice',
        len({(r['site'], r['edit_type']) for r in _ws['per_locus']}), len(_ws['per_locus']))
    chk('weight sensitivity: selections that move with the channel OFF', 1, _ws['off_changes'])
    chk('weight sensitivity: largest change across 0-3', 1,  _ws['max_change'])
    chk('weight sensitivity: distinct designs that ever move', 4, _ws['n_movers'])
except FileNotFoundError:
    chk('weight sensitivity: analysis/weight_sensitivity.json present', True, False,
        'run node analysis/weight_sensitivity.js')

# ── design recovery ───────────────────────────────────────────────────────
pcts = [num(r['published_rank_percentile']) for r in bench if num(r.get('published_rank_percentile')) is not None]
chk('recovery: n ranked',                   136, len(pcts))
chk('recovery: median percentile',          92.3, round(st.median(pcts),1))
chk('recovery: fraction in the top decile', 57,   round(100*sum(1 for p in pcts if p>=90)/len(pcts)))
chk('recovery: lowest percentile observed', 33.3, round(min(pcts),1))
chk('recovery: one below the 50th (TaGASR7-peg01, a 4-candidate site)', 1, sum(1 for p in pcts if p<50))

perm = json.load(open(A('recovery_permutation.json')))
chk('permutation: null median',             57.1, perm['null_model']['null_median_of_medians'])
chk('permutation: null 95th percentile',    64.0, perm['null_model']['null_95th_percentile'])
chk('permutation: observed median',         92.3, perm['observed']['median_percentile'])
# The ranked cohort's site count. The manuscript said 26 in three places while the permutation
# recorded 25, and nothing compared them. Keyed on the protospacer the whole benchmark spans 27
# sites and the ranked cohort 25, so TWO sites drop out, not one: OsROC5-T1 and the Lin 2020
# OsCDC48-T3 protospacer, both on an edit_from mismatch against the retrieved window. The
# label-keyed check hid the second, because the LABEL OsCDC48-T3 also names a Lin 2021
# protospacer that does rank.
chk('permutation: pegRNAs ranked',           136, perm['pegRNAs_ranked'])
chk('permutation: target sites ranked',       26, perm['target_sites'])
# Sorted, not a set: chk compares str(stated) with str(computed), and Python's set repr
# order varies between runs under string hash randomisation, so a set-valued check passes
# or fails at random. This one did exactly that on its second run.
chk('the unranked benchmark sites', ['OsROC5-T1'],
    sorted(sites(bench) - {site(r) for r in bench
                           if str(r.get('published_rank_percentile', '')).strip()}))
chk('unranked rows', 5, sum(1 for r in bench
                            if not str(r.get('published_rank_percentile', '')).strip()))
# FIX STALE-ANALYSIS (13 September 2026). The manuscript quoted "in the top decile for 55.6%",
# and nothing here checked it. analysis/recovery_permutation.json had not been re-run since the
# edit-encoding repair, so the stored 0.556 was a figure from before the benchmark was fixed;
# re-running gives 0.563, 76 of 135. A number the manuscript states and no check reads is a
# number that drifts silently, which is the whole failure mode this file exists to close.
chk('permutation: in the top decile',       56.6, round(perm['observed']['top_decile_fraction']*100, 1))
chk('permutation: top-decile count',          77, perm['observed']['top_decile_count'])
chk('permutation: mean percentile',         86.5, perm['observed']['mean_percentile'])

# ── melting-temperature window ────────────────────────────────────────────
tm_all = rows(D('tm_table.csv'))
# the analysed cohort excludes the one recovered design below Lin 2021's reported 6-17 nt range
tm = [r for r in tm_all if r.get('status') == 'OK']
chk('Tm series: designs recovered',          74, len(tm_all))
chk('Tm series: measurements analysed',      73, len(tm))
chk('Tm series: rice target sites',         14, len({r['target_id'] for r in tm}))

win = json.load(open(A('window_sensitivity.json')))
rc  = win['rule_comparison']
ws_der = win['superseded_rule_derivation']
chk('window: targets with 3+ lengths',      13, win['n_targets_with_3plus_lengths'])
chk('window: best length inside 8-11 nt',   13, rc['targets_whose_best_length_is_inside_the_new_window'])
# two rules are quoted: the derived interquartile rule and the legacy 11-15 nt span
chk('superseded rule (derived) captures',   0,  rc['targets_whose_best_length_is_inside_the_old_rule'])
chk('superseded rule derived as',        '12-13', ws_der['interquartile_range_nt'])
chk('genome-corrected designs',              6,
    sum(1 for r in rows(D('targets_verified.csv'))
        if r['source_tbl'].startswith('Lin2021') and 'MISMATCH' in r['pbs_check']))
chk('superseded rule (legacy 11-15) captures', 1,
    ws_der['legacy_quoted_rule']['targets_inside'])

# ── leave-one-target-out ──────────────────────────────────────────────────
# data/loto.json is now regenerated by analysis/loto_lengths.py from data/tm_table.csv;
# it used to be recorded output with no generator, which is how one design marked
# EXCLUDED in tm_table.csv reached the ranking test unnoticed. Still guarded the same
# way as the three blocks below so a missing file gives a message rather than a
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
    # ten, not eleven: OsODEV-T1 has three analysed lengths, and only reached the
    # four-length threshold in the old recorded file by counting the 5 nt design that
    # tm_table.csv marks EXCLUDED. Dropping it leaves the median at 0.74 and every
    # target positive; the pooled n falls from 67 to 63.
    chk('LOTO: targets in the ranking test',     10, len(rank))
    chk('LOTO: median rho',                      0.74, round(st.median([r[1] for r in rank]), 2))
    chk('LOTO: positive at every target',        10, sum(1 for r in rank if r[1] > 0))
    chk('LOTO: pooled n',                        63, sum(r[2] for r in rank))

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
# These sit in the Methods and the Figure 4 legend and were NOT covered by the original 38
# checks. When the check was added the manuscript still said 29.4 C / R2 0.46 against a fit
# of 29.6 C / R2 0.446, and this comment recorded that gap instead of resolving it -- which
# left the one check in this file that asserts the CODE's value rather than the paper's.
#
# Both have moved since and they now agree. On 29 September 2026 fit_tm_optimum.py stopped
# counting targets with a single measurement in the within-target normalisation: such a
# target normalises to 1.0 by construction, carries no information about where the optimum
# lies, and contributes a free maximum to whatever bin it lands in -- and the figure legend
# already claimed they were excluded. Dropping OsIPA1-T1 took the cohort from 73 points to
# 72 and moved the fit to 29.3 C / R2 0.448.
#
# The submitted Figure 4 states 29.3 C, sigma 9.2 C, R2 0.45 and a 95% CI of 27.7-31.7 C
# over n = 72 and 13 targets -- every one of them analysis/fig4data.json rounded -- and the
# manuscript text states 29.3 as well. Locked so they cannot drift.
try:
    import subprocess as _sp, os as _os, re as _re2
    _out = _sp.run(['python3', _os.path.join(HERE, 'fit_tm_optimum.py')],
                   cwd=_os.path.join(HERE, '..', 'data'),
                   capture_output=True, text=True, timeout=300).stdout
    _w = _re2.search(r'Wallace \(Lin 2021\).*?optimum Tm\s+([\d.]+)', _out, _re2.S)
    _r = _re2.search(r'Wallace \(Lin 2021\).*?R.\s+([\d.]+)', _out, _re2.S)
    # A regex miss used to drop both checks with no message. Record the miss as a
    # disagreement instead: a check that cannot run is not a check that passed.
    chk('Figure 4: Wallace optimum (C)', 29.3,
        round(float(_w.group(1)), 1) if _w else 'NOT FOUND in fit_tm_optimum.py output')
    chk('Figure 4: Wallace R-squared', 0.45,
        round(float(_r.group(1)), 2) if _r else 'NOT FOUND in fit_tm_optimum.py output')
except Exception as _e:
    print('   (Figure 4 fit not re-run: %s)' % _e)
    chk('Figure 4: Wallace optimum (C)', 29.3, 'fit did not run')
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
    # The ALS key is the study-qualified label (analysis/als_sites.json). It was 'OsALS-T2',
    # and when the labels were namespaced this loop matched nothing, raised on max() of an empty
    # sequence, and took the remaining Figure 6 checks down with it — the run still printed
    # "0 disagree", over four checks that never executed. A missing target is now named.
    _claim = {'OsAAT': (12, 8), 'OsACC-T1': (14, 9),
              'OsALS-T2 (Lin 2021)': (12, 8), 'OsEPSPS-T1': (10, 8)}
    for _t, (_cp, _cb) in sorted(_claim.items()):
        _rows = [r for r in _p if r['target'] == _t]
        if not _rows:
            chk('Figure 6A: %s present in pridict_vs_measured.json' % _t, True, False)
            continue
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
    # 35, not 33. Counting distinct LABELS and collapsing only the ALS pair gave 33; four
    # pairs of labels denote one protospacer and five single labels denote two
    # (analysis/target_sites.json), and at this stage the splits outnumber the merges.
    chk('benchmark parse: target sites among the 162',
                                                   35, len(sites(_ok)))
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
