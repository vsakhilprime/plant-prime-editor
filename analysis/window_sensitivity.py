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

rows = [r for r in csv.DictReader(open(TM)) if r['efficiency'].strip()]
by = defaultdict(list)
for r in rows:
    by[r['target_id']].append((int(r['pbs_length']), float(r['efficiency']),
                               float(r['wallace_tm']), float(r['nn_tm'])))

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
    # a uniform draw over the 5-17 nt range actually tested
    expected = width / 13.0
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
# the superseded rule: 30 C read on a nearest-neighbour scale selects 11-15 nt
# the recalibrated window: 8-11 nt
OLD = (11, 15)
NEW = (8, 11)
in_new = [t for t, v in best.items() if NEW[0] <= v[0] <= NEW[1]]
in_old = [t for t, v in best.items() if OLD[0] <= v[0] <= OLD[1]]
both = set(in_new) & set(in_old)
only_new = set(in_new) - set(in_old)
only_old = set(in_old) - set(in_new)

# every measured design, not just the best per target
all_lengths = [L for v in by.values() for (L, e, w, n) in v]
changed = sum(1 for L in all_lengths if (NEW[0] <= L <= NEW[1]) != (OLD[0] <= L <= OLD[1]))

out = {
    'n_targets_with_3plus_lengths': n_t,
    'best_length_per_target': {t: v[0] for t, v in sorted(best.items())},
    'median_best_length': st.median(lengths),
    'boundary_sensitivity': sens,
    'rule_comparison': {
        'superseded_rule_nt': f'{OLD[0]}-{OLD[1]}',
        'recalibrated_window_nt': f'{NEW[0]}-{NEW[1]}',
        'targets_whose_best_length_is_inside_the_new_window': len(in_new),
        'targets_whose_best_length_is_inside_the_old_rule': len(in_old),
        'inside_both': sorted(both),
        'captured_only_by_the_new_window': sorted(only_new),
        'captured_only_by_the_old_rule': sorted(only_old),
        'measured_designs_classified_differently': changed,
        'measured_designs_total': len(all_lengths),
        'fraction_reclassified': round(changed / len(all_lengths), 3),
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

rc = out['rule_comparison']
print('\nWHAT THE RECALIBRATION CHANGES')
print('  best length inside the recalibrated 8-11 nt window : %d of %d targets' % (rc['targets_whose_best_length_is_inside_the_new_window'], n_t))
print('  best length inside the superseded 11-15 nt rule    : %d of %d targets' % (rc['targets_whose_best_length_is_inside_the_old_rule'], n_t))
print('  captured only by the new window                    : %s' % ', '.join(rc['captured_only_by_the_new_window']) or 'none')
print('  captured only by the old rule                      : %s' % (', '.join(rc['captured_only_by_the_old_rule']) or 'none'))
print('  measured designs the two rules classify differently: %d of %d (%.0f%%)' % (
    rc['measured_designs_classified_differently'], rc['measured_designs_total'], 100 * rc['fraction_reclassified']))
print('\nwrote analysis/window_sensitivity.json')
