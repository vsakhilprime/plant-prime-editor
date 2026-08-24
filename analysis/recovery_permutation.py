#!/usr/bin/env python3
"""
Plant Prime Editor — permutation null for the design-recovery statistic.

The Results section reports that the platform ranks the design the original authors
chose in the top 11% of its own candidate list at the median. That is a claim about
ordering, and an ordering claim needs a null: a tool returning candidates in random
order places the published design at the 50th percentile on average.

This reads the canonical scored benchmark produced by merge_benchmark.py, so the
statistic and the null come from the same file as every other benchmark number.

    python3 analysis/merge_benchmark.py        # first
    python3 analysis/recovery_permutation.py

Writes analysis/recovery_permutation.json
Standard library only.
"""
import csv, json, os, random, statistics as st, collections

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'data', 'benchmark_scored.csv')

rows = list(csv.DictReader(open(SRC, newline='', encoding='utf-8-sig')))
recs = []
for r in rows:
    pct = str(r.get('published_rank_percentile', '')).strip()
    n   = str(r.get('n_candidates', '')).strip()
    rk  = str(r.get('published_rank', '')).strip()
    if not pct or not n:
        continue
    recs.append({
        'id': r['id'], 'locus': r['locus'], 'species': r['species'],
        'n': int(float(n)), 'rank': int(float(rk)) if rk else None,
        'percentile': float(pct),
    })

pcts = [r['percentile'] for r in recs]
obs_median = st.median(pcts)
obs_top10 = sum(1 for p in pcts if p >= 90)
obs_min = min(pcts)

# ── null: each pegRNA's rank replaced by a uniform draw over its own candidate list ──
N = 10000
rng = random.Random(20260813)
null_medians = []
for _ in range(N):
    draw = [100.0 * (r['n'] - (rng.randrange(r['n']))) / r['n'] for r in recs]
    null_medians.append(st.median(draw))
ge = sum(1 for m in null_medians if m >= obs_median)
p_value = (ge + 1) / (N + 1)
null_medians.sort()

by_sp = collections.Counter(r['species'] for r in recs)
out = {
    'source_file': 'data/benchmark_scored.csv',
    'pegRNAs_ranked': len(recs),
    'target_sites': len({r['locus'] for r in recs}),
    'species': dict(by_sp),
    'observed': {
        'median_percentile': round(obs_median, 1),
        'top_percent_at_the_median': round(100 - obs_median, 1),
        'mean_percentile': round(st.mean(pcts), 1),
        'top_decile_count': obs_top10,
        'top_decile_fraction': round(obs_top10 / len(recs), 3),
        'minimum_percentile': round(obs_min, 1),
        'below_50th_percentile': sum(1 for p in pcts if p < 50),
    },
    'null_model': {
        'description': "each pegRNA's rank replaced by a uniform draw over its own candidate list",
        'permutations': N,
        'null_median_of_medians': round(st.median(null_medians), 1),
        'null_95th_percentile': round(null_medians[int(0.95 * N)], 1),
        'p_value': p_value,
        'p_reported': '< 1e-4' if p_value <= 1 / (N + 1) else ('%.4g' % p_value),
    },
}
json.dump(out, open(os.path.join(HERE, 'recovery_permutation.json'), 'w'), indent=2)

o = out['observed']; n = out['null_model']
print('\nDESIGN-RECOVERY PERMUTATION TEST   (canonical merged benchmark)')
print('  pegRNAs ranked                    : %d at %d target sites' % (out['pegRNAs_ranked'], out['target_sites']))
print('  species                           : %s' % ', '.join('%s %d' % (k, v) for k, v in sorted(by_sp.items())))
print('  median percentile                 : %.1f  (top %.0f%%)' % (o['median_percentile'], o['top_percent_at_the_median']))
print('  in the top decile                 : %d of %d = %.0f%%' % (o['top_decile_count'], out['pegRNAs_ranked'], 100 * o['top_decile_fraction']))
print('  minimum percentile observed       : %.1f' % o['minimum_percentile'])
print('  below the 50th percentile         : %d' % o['below_50th_percentile'])
print('  null median (uninformative)       : %.1f' % n['null_median_of_medians'])
print('  null 95th percentile              : %.1f' % n['null_95th_percentile'])
print('  P                                 : %s' % n['p_reported'])
print('\nwrote analysis/recovery_permutation.json')
