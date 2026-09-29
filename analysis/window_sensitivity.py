#!/usr/bin/env python3
"""
Plant Prime Editor — how sensitive is the primer-binding-site window?

Two questions a referee is entitled to ask about a fitted window:

  1. Is the leave-one-target-out result an artefact of where the boundaries were
     drawn? If 13 of 13 held-out targets fall inside 8-11 nt but only 6 of 13 fall
     inside 8-12 nt, the window is knife-edge and the agreement is luck.
  2. What does the recalibration actually change? An arithmetic correction is only
     interesting if it moves designs, so this counts how many published designs sit
     in the recalibrated window but outside the rule it replaces.

    python3 analysis/window_sensitivity.py

Writes analysis/window_sensitivity.json
Requires only the standard library.
"""
import csv, json, os, statistics as st
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TM = os.path.join(HERE, '..', 'data', 'tm_table.csv')

# status filter: one recovered design (OsODEV-T1, 5 nt) lies below the 6-17 nt range
# Lin 2021 report for Fig 1b. It is kept in tm_table.csv as recovered data and excluded
# from analysis, so the cohort matches the range the source paper actually tested.
rows = [r for r in csv.DictReader(open(TM)) if r['efficiency'].strip() and r['status'] == 'OK']
by = defaultdict(list)
for r in rows:
    by[r['target_id']].append((int(r['pbs_length']), float(r['efficiency']),
                               float(r['wallace_tm']), float(r['nn_tm'])))

# The uniform baseline is the number of DISTINCT primer-binding-site lengths actually
# analysed, computed rather than hard-coded. It was previously fixed at 13, which was
# the 5-17 nt span; on the 6-17 nt cohort it is 12, and every enrichment scales with it.
LENGTHS_TESTED = sorted({L for v in by.values() for (L, e, w, n) in v})
N_LENGTHS = len(LENGTHS_TESTED)

# best-performing primer-binding site at each target
best = {}
for t, v in by.items():
    if len(v) < 3:          # a target with fewer than three lengths has no meaningful argmax
        continue
    best[t] = max(v, key=lambda x: x[1])

lengths = sorted(v[0] for v in best.values())
n_t = len(best)

# ── 1. sensitivity of the argmax result to the window boundaries ─────────────
windows = [(7, 10), (7, 11), (7, 12), (8, 10), (8, 11), (8, 12), (8, 13),
           (9, 11), (9, 12), (6, 11), (10, 13), (11, 15)]
sens = []
for lo, hi in windows:
    inside = sum(1 for L in lengths if lo <= L <= hi)
    width = hi - lo + 1
    # a uniform draw over the range actually tested
    expected = width / float(N_LENGTHS)
    sens.append({
        'window_nt': f'{lo}-{hi}',
        'width_nt': width,
        'targets_inside': inside,
        'of': n_t,
        'fraction': round(inside / n_t, 3),
        'expected_if_uniform': round(expected, 3),
        'enrichment': round((inside / n_t) / expected, 2) if expected else None,
    })

# ── 2. what the recalibration changes ───────────────────────────────────────
# The superseded rule is what you get by reading Lin 2021's 30 C figure directly on the
# nearest-neighbour scale. Earlier versions hard-coded that as 11-15 nt with no
# derivation, which is not something a referee should have to take on trust. It is now
# DERIVED: for each target, take the primer-binding-site length whose nearest-neighbour
# melting temperature lies closest to 30 C, then use the interquartile range of that
# distribution across targets. The legacy 11-15 nt span is still reported alongside it
# so the two can be compared.
def _nearest30(v):
    return min(v, key=lambda x: abs(x[3] - 30.0))[0]

near30 = sorted(_nearest30(v) for t, v in by.items() if len(v) >= 3)
_q = st.quantiles(near30, n=4)
OLD = (int(round(_q[0])), int(round(_q[2])))     # derived: interquartile range
OLD_LEGACY = (11, 15)                            # the span quoted in earlier versions
NEW = (8, 11)
in_new = [t for t, v in best.items() if NEW[0] <= v[0] <= NEW[1]]
in_old = [t for t, v in best.items() if OLD[0] <= v[0] <= OLD[1]]
both = set(in_new) & set(in_old)
only_new = set(in_new) - set(in_old)
only_old = set(in_old) - set(in_new)

# every measured design, not just the best per target
all_lengths = [L for v in by.values() for (L, e, w, n) in v]
changed = sum(1 for L in all_lengths if (NEW[0] <= L <= NEW[1]) != (OLD[0] <= L <= OLD[1]))
changed_legacy = sum(1 for L in all_lengths
                     if (NEW[0] <= L <= NEW[1]) != (OLD_LEGACY[0] <= L <= OLD_LEGACY[1]))

def _rule(lo, hi):
    inside = [t for t, v in best.items() if lo <= v[0] <= hi]
    width = hi - lo + 1
    exp = width / float(N_LENGTHS)
    return {'rule_nt': f'{lo}-{hi}', 'width_nt': width, 'targets_inside': len(inside),
            'of': n_t, 'expected_if_uniform': round(exp, 3),
            'enrichment': round((len(inside) / n_t) / exp, 2), 'targets': sorted(inside)}

out = {
    'n_targets_with_3plus_lengths': n_t,
    'lengths_analysed_nt': LENGTHS_TESTED,
    'n_distinct_lengths_for_uniform_baseline': N_LENGTHS,
    'superseded_rule_derivation': {
        'method': ('per target, the PBS length whose nearest-neighbour Tm lies closest to '
                   'the 30 C figure of Lin 2021; the rule is the interquartile range of '
                   'that distribution across targets'),
        'nearest_30C_length_per_target': near30,
        'median_nt': st.median(near30),
        'interquartile_range_nt': f'{OLD[0]}-{OLD[1]}',
        'full_range_nt': f'{min(near30)}-{max(near30)}',
        'derived_rule': _rule(*OLD),
        'legacy_quoted_rule': _rule(*OLD_LEGACY),
    },
    'best_length_per_target': {t: v[0] for t, v in sorted(best.items())},
    'median_best_length': st.median(lengths),
    'boundary_sensitivity': sens,
    'rule_comparison': {
        'superseded_rule_nt': f'{OLD[0]}-{OLD[1]}',
        'superseded_rule_is': 'derived (interquartile range of the nearest-30 C length)',
        'legacy_quoted_rule_nt': f'{OLD_LEGACY[0]}-{OLD_LEGACY[1]}',
        'recalibrated_window_nt': f'{NEW[0]}-{NEW[1]}',
        'targets_whose_best_length_is_inside_the_new_window': len(in_new),
        'targets_whose_best_length_is_inside_the_old_rule': len(in_old),
        'inside_both': sorted(both),
        'captured_only_by_the_new_window': sorted(only_new),
        'captured_only_by_the_old_rule': sorted(only_old),
        'measured_designs_classified_differently': changed,
        'measured_designs_total': len(all_lengths),
        'fraction_reclassified': round(changed / len(all_lengths), 3),
        'measured_designs_classified_differently_vs_legacy_rule': changed_legacy,
        'fraction_reclassified_vs_legacy_rule': round(changed_legacy / len(all_lengths), 3),
    },
}
json.dump(out, open(os.path.join(HERE, 'window_sensitivity.json'), 'w'), indent=2)

print('\nWINDOW BOUNDARY SENSITIVITY   (best-performing PBS at each target, n = %d)' % n_t)
print('  best lengths observed:', lengths)
print('  %-12s %-6s %-14s %-12s %s' % ('window', 'width', 'targets inside', 'if uniform', 'enrichment'))
for s in sens:
    mark = '   <- window used' if s['window_nt'] == '8-11' else ''
    print('  %-12s %-6s %-14s %-12s %sx%s' % (
        s['window_nt'] + ' nt', s['width_nt'], f"{s['targets_inside']}/{s['of']}",
        f"{s['expected_if_uniform']:.2f}", s['enrichment'], mark))

d = out['superseded_rule_derivation']
print('\nTHE SUPERSEDED RULE, DERIVED RATHER THAN ASSUMED')
print('  nearest-30 C length per target : %s' % d['nearest_30C_length_per_target'])
print('  median %g nt, interquartile range %s nt, full range %s nt'
      % (d['median_nt'], d['interquartile_range_nt'], d['full_range_nt']))
print('  derived rule %s nt : best length inside at %d of %d targets (enrichment %sx)'
      % (d['derived_rule']['rule_nt'], d['derived_rule']['targets_inside'], n_t,
         d['derived_rule']['enrichment']))
print('  legacy  rule %s nt : best length inside at %d of %d targets (enrichment %sx)'
      % (d['legacy_quoted_rule']['rule_nt'], d['legacy_quoted_rule']['targets_inside'], n_t,
         d['legacy_quoted_rule']['enrichment']))
print('  uniform baseline: %d distinct lengths analysed (%s nt)'
      % (N_LENGTHS, '%d-%d' % (LENGTHS_TESTED[0], LENGTHS_TESTED[-1])))

rc = out['rule_comparison']
print('\nWHAT THE RECALIBRATION CHANGES')
print('  best length inside the recalibrated 8-11 nt window : %d of %d targets' % (rc['targets_whose_best_length_is_inside_the_new_window'], n_t))
print('  best length inside the superseded %-5s nt rule   : %d of %d targets'
      % (rc['superseded_rule_nt'], rc['targets_whose_best_length_is_inside_the_old_rule'], n_t))
print('  captured only by the new window                    : %s' % ', '.join(rc['captured_only_by_the_new_window']) or 'none')
print('  captured only by the old rule                      : %s' % (', '.join(rc['captured_only_by_the_old_rule']) or 'none'))
print('  designs classified differently, derived %-5s nt  : %d of %d (%.0f%%)' % (
    rc['superseded_rule_nt'], rc['measured_designs_classified_differently'],
    rc['measured_designs_total'], 100 * rc['fraction_reclassified']))
print('  designs classified differently, legacy  %-5s nt  : %d of %d (%.0f%%)' % (
    rc['legacy_quoted_rule_nt'], rc['measured_designs_classified_differently_vs_legacy_rule'],
    rc['measured_designs_total'], 100 * rc['fraction_reclassified_vs_legacy_rule']))
print('\nwrote analysis/window_sensitivity.json')
