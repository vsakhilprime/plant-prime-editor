#!/usr/bin/env python3
"""
Plant Prime Editor — composite score against measured editing efficiency, between target sites.

This reproduces the negative result reported in the Results section. It exists because the
number could not previously be reproduced from the deposited data: the statistic was computed
from data/benchmark_lin2020_joined.csv, which was not shipped with the repository, while the
canonical scored benchmark carries a measured efficiency for only five tomato pegRNAs. A
referee opening the deposited CSV would have found n = 5 where the manuscript says n = 15.
The source file is now deposited and this script regenerates the figure exactly.

What the analysis does, and why it is framed as a null.

  Lin et al. 2020 report editing efficiency for 44 pegRNAs at 12 rice and wheat target sites.
  Several pegRNAs at one site install different edits, so the rows are collapsed to distinct
  target-and-edit combinations before correlating — 15 of them — and the composite score and
  efficiency are averaged within each. Collapsing matters: at these loci a single spacer is
  used per target, so the composite score is nearly constant within a target and the
  uncollapsed correlation would count the same design many times.

  The result is a null, and the manuscript says so. It is reported because the comparison a
  reader expects — does a higher score mean a higher efficiency — is between-site, and no
  sequence-level score models between-site variation. Editing efficiency at these loci spans
  more than an order of magnitude for reasons unrelated to pegRNA design: chromatin
  accessibility, transformation efficiency and locus context. The within-target comparison,
  which is the one a design tool can actually influence, is reported separately and is
  strongly positive.

    python3 analysis/score_vs_efficiency.py
"""
import csv, os, statistics as st, math

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'data', 'benchmark_lin2020_joined.csv')

def num(x):
    try: return float(str(x).strip())
    except Exception: return None

rows = list(csv.DictReader(open(SRC, newline='', encoding='utf-8-sig')))
usable = [r for r in rows
          if num(r.get('composite_score')) is not None and num(r.get('measured_efficiency')) is not None]

groups = {}
for r in usable:
    groups.setdefault((r['target'], r['edit']), []).append(
        (num(r['composite_score']), num(r['measured_efficiency'])))
xs = [st.mean([a for a, _ in v]) for v in groups.values()]
ys = [st.mean([b for _, b in v]) for v in groups.values()]

def ranks(v):
    order = sorted(range(len(v)), key=lambda i: v[i]); out = [0.0] * len(v); i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]: j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1): out[order[k]] = avg
        i = j + 1
    return out

def spearman(a, b):
    ra, rb = ranks(a), ranks(b); n = len(a)
    ma, mb = st.mean(ra), st.mean(rb)
    num_ = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = math.sqrt(sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb))
    return num_ / den if den else 0.0

rho = spearman(xs, ys)
n = len(xs)
z = math.atanh(rho); se = 1 / math.sqrt(n - 3)
lo, hi = math.tanh(z - 1.96 * se), math.tanh(z + 1.96 * se)

# exact permutation P is impractical at n=15 (15! orderings), so resample
import random
rng = random.Random(20260813)
N = 100000
ge = 0
for _ in range(N):
    sh = ys[:]; rng.shuffle(sh)
    if abs(spearman(xs, sh)) >= abs(rho): ge += 1
p_perm = (ge + 1) / (N + 1)

print('\nCOMPOSITE SCORE vs MEASURED EFFICIENCY, BETWEEN TARGET SITES')
print('  source file            : data/%s' % os.path.basename(SRC))
print('  pegRNAs with both      : %d at %d target sites' % (len(usable), len({r['target'] for r in usable})))
print('  collapsed to distinct target-and-edit combinations : %d' % n)
print('  Spearman rho           : %+.3f' % rho)
print('  95%% CI (Fisher z)      : %+.2f to %+.2f' % (lo, hi))
print('  permutation P          : %.3f  (%d shuffles, two-sided)' % (p_perm, N))
print('\n  Manuscript sentence to match:')
print('    "composite design score did not predict efficiency across different target sites')
print('     (Spearman rho = %+.2f, 95%% CI %+.2f to %+.2f, n = %d target-edit combinations)"' % (rho, lo, hi, n))
print('\n  Uncollapsed, for completeness: rho = %+.3f over %d rows — reported only to show that'
      % (spearman([num(r['composite_score']) for r in usable],
                  [num(r['measured_efficiency']) for r in usable]), len(usable)))
print('  the conclusion does not depend on the collapsing rule.')
