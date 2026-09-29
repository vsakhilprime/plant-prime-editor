#!/usr/bin/env python3
"""
Plant Prime Editor — the leave-one-target-out test of the primer-binding-site window.

`data/loto.json` used to be recorded output with no generator in the deposit; the
README said so, and `verify_manuscript_numbers.py` read five checks out of a file
nothing could rebuild. This script rebuilds it from `data/tm_table.csv`, which is
the primary source, so the numbers in Supplementary Figure S4 can be regenerated
rather than trusted.

    python3 analysis/loto_lengths.py            # rewrites data/loto.json
    python3 analysis/loto_lengths.py --check    # verifies without writing

Cohort
------
Rows with a measured efficiency and status OK. One design (OsODEV-T1 at 5 nt) is
marked EXCLUDED in tm_table.csv — "below the 6-17 nt range Lin 2021 reports for
Fig 1b; retained here as recovered data but not analysed" — and is excluded here
too. The previously recorded loto.json counted it, which is the one place in the
deposit where that design reached an analysis; see the CORRECTION note below.

Three quantities, and only the last two are out of sample
--------------------------------------------------------
1. argmax vs the published window.  The best-measured length at each target
   against the fixed 8-11 nt window. This is a DESCRIPTION, not a test: the
   manuscript derives 8-11 as "the narrowest window retaining every target", so
   the count of 13 of 13 is what the window was chosen to achieve. It is reported
   because it is the number in the text, and labelled for what it is.

2. argmax vs a leave-one-out optimum.  For each target, the optimum re-derived
   from the other twelve alone (the median of their best lengths, rounded up --
   over this cohort the median is always 9.0 or 9.5, so the value is always 9 or
   10). The withheld target contributes nothing to the value used to predict it.

3. argmax vs a leave-one-out WINDOW.  The same selection rule the manuscript
   applies -- the narrowest window retaining every target -- but applied to the
   other twelve alone, then asked whether the withheld best falls inside it. This
   is the out-of-sample version of claim 1 and it is the one a referee will ask
   for.

4. ranking.  Per target, the Spearman correlation between measured efficiency and
   proximity to the withheld optimum. Restricted to targets with four or more
   analysed lengths, because n = 3 admits only rho in {-1, -0.5, +0.5, +1}.

CORRECTION (this script, against the recorded file)
---------------------------------------------------
  * OsODEV-T1 was recorded with n = 4 and rho = +0.7379. Both come from including
    the EXCLUDED 5 nt design. On the analysed cohort it has n = 3, which puts it
    below the four-length threshold, so it leaves the ranking test: eleven targets
    become ten and the pooled n falls from 67 to 63. The median is unchanged at
    +0.74 and every target is still positive; the one-sided sign test moves from
    P = 4.9e-4 to P = 9.8e-4.

Requires only the standard library.
"""
import csv, json, math, os, sys, statistics as st
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TM   = os.path.join(HERE, '..', 'data', 'tm_table.csv')
OUT  = os.path.join(HERE, '..', 'data', 'loto.json')

MIN_LENGTHS_FOR_ARGMAX  = 3   # fewer than three lengths gives no meaningful argmax
MIN_LENGTHS_FOR_RANKING = 4   # n = 3 admits only rho in {-1, -0.5, +0.5, +1}
WINDOW = (8, 11)              # the window the manuscript publishes


# ── statistics, written out rather than imported, so the deposit needs no SciPy ──
def _ranks(a):
    """Ranks, ties averaged."""
    order = sorted(range(len(a)), key=lambda i: a[i])
    r = [0.0] * len(a)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and a[order[j + 1]] == a[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1
        for k in range(i, j + 1):
            r[order[k]] = avg
        i = j + 1
    return r


def _pearson(x, y):
    n = len(x)
    mx, my = sum(x) / n, sum(y) / n
    num = sum((a - mx) * (b - my) for a, b in zip(x, y))
    dx = math.sqrt(sum((a - mx) ** 2 for a in x))
    dy = math.sqrt(sum((b - my) ** 2 for b in y))
    return num / (dx * dy) if dx and dy else float('nan')


def spearman(x, y):
    return _pearson(_ranks(x), _ranks(y))


def load():
    allrows = list(csv.DictReader(open(TM)))
    rows = [r for r in allrows if r['efficiency'].strip() and r['status'] == 'OK']
    excluded = sorted({r['target_id'] for r in allrows
                       if r['efficiency'].strip() and r['status'] != 'OK'})
    by = defaultdict(list)
    for r in rows:
        by[r['target_id']].append((int(r['pbs_length']), float(r['efficiency'])))
    for v in by.values():
        v.sort()
    return by, excluded


def compute():
    by, excl_targets = load()
    lengths_tested = sorted({L for v in by.values() for L, _ in v})
    n_lengths = len(lengths_tested)

    best = {t: max(v, key=lambda x: x[1])[0]
            for t, v in by.items() if len(v) >= MIN_LENGTHS_FOR_ARGMAX}
    too_few = sorted(t for t in by if t not in best)

    argmax, loto_windows = [], {}
    for t in sorted(best):
        others = sorted(best[u] for u in best if u != t)
        opt = math.ceil(st.median(others))
        # the manuscript's own selection rule, applied without this target
        win = (min(others), max(others))
        loto_windows[t] = win
        argmax.append([t, best[t], opt, len(by[t])])

    inside_fixed = sum(1 for t, b, _o, _n in argmax if WINDOW[0] <= b <= WINDOW[1])
    within2      = sum(1 for t, b, o, _n in argmax if abs(b - o) <= 2)
    max_dev      = max(abs(b - o) for _t, b, o, _n in argmax)
    inside_loto  = sum(1 for t, b, _o, _n in argmax
                       if loto_windows[t][0] <= b <= loto_windows[t][1])
    outside_loto = [t for t, b, _o, _n in argmax
                    if not (loto_windows[t][0] <= b <= loto_windows[t][1])]

    # uniform-draw baselines over the lengths actually tested
    p_fixed = ((WINDOW[1] - WINDOW[0] + 1) / n_lengths) ** len(argmax)
    p_within2 = math.exp(sum(math.log(sum(1 for L in lengths_tested if abs(L - o) <= 2) / n_lengths)
                             for _t, _b, o, _n in argmax))
    # P(at least `inside_loto` of the folds land inside their own leave-one-out window),
    # each fold with its own probability -- a Poisson-binomial tail, small enough to
    # enumerate by dynamic programming rather than approximate
    ps = [sum(1 for L in lengths_tested if loto_windows[t][0] <= L <= loto_windows[t][1]) / n_lengths
          for t, _b, _o, _n in argmax]
    dist = [1.0]
    for p in ps:
        nxt = [0.0] * (len(dist) + 1)
        for k, w in enumerate(dist):
            nxt[k] += w * (1 - p)
            nxt[k + 1] += w * p
        dist = nxt
    p_loto_window = sum(dist[inside_loto:])

    ranking = []
    for t, b, o, n in argmax:
        if n < MIN_LENGTHS_FOR_RANKING:
            continue
        v = by[t]
        rho = spearman([-abs(L - o) for L, _e in v], [e for _L, e in v])
        ranking.append([t, rho, n])

    rhos = [r[1] for r in ranking]
    n_pos = sum(1 for r in rhos if r > 0)
    sign_p_one = 0.5 ** len(rhos) if n_pos == len(rhos) else None

    return {
        'generated_by': 'analysis/loto_lengths.py',
        'source': 'data/tm_table.csv, rows with a measured efficiency and status OK',
        'cohort': {
            'targets_with_measurements': len(by),
            'targets_in_argmax_test': len(argmax),
            'targets_in_ranking_test': len(ranking),
            'excluded_too_few_lengths': too_few,
            'targets_with_a_non_OK_row': excl_targets,
            'lengths_tested_nt': lengths_tested,
            'n_distinct_lengths': n_lengths,
            'min_lengths_for_argmax': MIN_LENGTHS_FOR_ARGMAX,
            'min_lengths_for_ranking': MIN_LENGTHS_FOR_RANKING,
        },
        'loto_optimum_rule': 'median of the best lengths of the other targets, rounded up',
        'loto_window_rule': 'narrowest window retaining every other target, i.e. [min, max] of their best lengths',
        'published_window_nt': list(WINDOW),
        'argmax': argmax,
        'loto_windows': {t: list(w) for t, w in loto_windows.items()},
        'tests': {
            'inside_published_window': {
                'k': inside_fixed, 'n': len(argmax), 'binomial_P': p_fixed,
                'out_of_sample': False,
                'note': ('the published window is the narrowest one retaining every target, '
                         'so this count is what the window was selected to achieve, not a test of it'),
            },
            'within_2nt_of_leave_one_out_optimum': {
                'k': within2, 'n': len(argmax), 'max_deviation_nt': max_dev,
                'binomial_P': p_within2, 'out_of_sample': True,
            },
            'inside_leave_one_out_window': {
                'k': inside_loto, 'n': len(argmax), 'P': p_loto_window,
                'targets_outside': outside_loto, 'out_of_sample': True,
            },
            'ranking': {
                'n_targets': len(ranking), 'n_positive': n_pos,
                'median_rho': st.median(rhos), 'min_rho': min(rhos), 'max_rho': max(rhos),
                'pooled_n': sum(r[2] for r in ranking),
                'sign_test_P_one_sided': sign_p_one,
                'sign_test_P_two_sided': 2 * sign_p_one if sign_p_one is not None else None,
                'out_of_sample': True,
            },
        },
        'ranking': ranking,
        'excluded': too_few,
    }


def main():
    d = compute()
    check = '--check' in sys.argv
    if check:
        old = json.load(open(OUT))
        for key in ('argmax', 'ranking'):
            if [list(r) for r in old.get(key, [])] != [list(r) for r in d[key]]:
                print(f'  MISMATCH in {key}:')
                print(f'    recorded: {old.get(key)}')
                print(f'    computed: {d[key]}')
                return 1
        print('  data/loto.json matches the recomputation')
        return 0
    json.dump(d, open(OUT, 'w'), indent=1)
    t = d['tests']
    print(f"wrote {OUT}")
    print(f"  argmax test    {t['inside_published_window']['k']} of {t['inside_published_window']['n']} "
          f"inside {d['published_window_nt'][0]}-{d['published_window_nt'][1]} nt "
          f"(P = {t['inside_published_window']['binomial_P']:.1e}, IN SAMPLE)")
    print(f"  out of sample  {t['within_2nt_of_leave_one_out_optimum']['k']} of "
          f"{t['within_2nt_of_leave_one_out_optimum']['n']} within "
          f"{t['within_2nt_of_leave_one_out_optimum']['max_deviation_nt']} nt of their own "
          f"leave-one-out optimum (P = {t['within_2nt_of_leave_one_out_optimum']['binomial_P']:.1e})")
    print(f"  out of sample  {t['inside_leave_one_out_window']['k']} of "
          f"{t['inside_leave_one_out_window']['n']} inside their own leave-one-out window "
          f"(P = {t['inside_leave_one_out_window']['P']:.1e}); "
          f"outside: {t['inside_leave_one_out_window']['targets_outside'] or 'none'}")
    r = t['ranking']
    print(f"  ranking        median rho {r['median_rho']:+.4f} over {r['n_targets']} targets, "
          f"{r['n_positive']} positive, pooled n {r['pooled_n']}, "
          f"one-sided sign test P = {r['sign_test_P_one_sided']:.1e}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
