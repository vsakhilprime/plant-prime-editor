#!/usr/bin/env python3
"""Rebuild data/benchmark_lin2020_joined.csv from the canonical scored benchmark.

WHY THIS SCRIPT EXISTS
──────────────────────
benchmark_lin2020_joined.csv joins two things: the tool's scores for 44 Lin 2020
pegRNAs, and the editing efficiencies for those pegRNAs digitised from Lin 2020
Fig. 1e/1f. The efficiency column is irreplaceable — it exists nowhere else in the
deposit, because benchmark_scored.csv carries a measured efficiency for only the
five tomato rows. The score columns are not irreplaceable: they are the tool's
own output, and benchmark_scored.csv is the canonical record of it.

Until 23 August 2026 the file was a hand-built snapshot with no generator, and its
score columns had drifted:

  composite_score          differed on all 44 rows, by exactly +8 on the 42 whose
                           spacer starts with G and +0 on the two that do not —
                           i.e. it predated the removal of the 5'-G bonus, which
                           benchmark_scored.csv records as gstart_term = 0 on
                           every row.
  published_rank_percentile differed on 4 rows. One of them, TaGASR7-peg01, is the
                           row verify_manuscript_numbers.py locks as the lowest
                           percentile observed: the joined file said 66.7, the
                           canonical benchmark says 33.3.
  pbs_tm                   differed on 22 rows (one by 38 °C — the Tm scale was
                           recalibrated in between).
  pbs_rt_dG                differed on 3 rows.

The between-site statistic in the Results is computed from this file, so it was
being computed from superseded scores. Rebuilding it moved the correlation from
rho = -0.243 to rho = -0.318. The conclusion is unchanged — it is a null either
way, and the manuscript reports it as one — but the number a reader reproduces
now matches the number the manuscript states.

WHAT IS PRESERVED AND WHAT IS RECOMPUTED
────────────────────────────────────────
Preserved from the existing file, because they are not derivable from anything
else here: measured_efficiency, efficiency_source, pe_system, target, edit,
species.

Recomputed from data/benchmark_scored.csv: composite_score, pbs_tm, pbs_rt_dG,
nick_edit_dist, ir_score, published_rank_percentile.

The script refuses to write if any id is missing from the canonical benchmark, or
if any efficiency value would be lost, rather than writing a file with a hole in
it.

    python3 analysis/rebuild_lin2020_join.py            # rewrite the join
    python3 analysis/rebuild_lin2020_join.py --check    # report drift, write nothing
"""
import csv, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
JOIN = os.path.join(DATA, 'benchmark_lin2020_joined.csv')
CANON = os.path.join(DATA, 'benchmark_scored.csv')

CHECK_ONLY = '--check' in sys.argv

# columns taken from the canonical benchmark, and the column each comes from
FROM_CANON = {
    'composite_score': 'composite_score',
    'pbs_tm': 'pbs_tm',
    'pbs_rt_dG': 'pbs_rt_dG',
    'nick_edit_dist': 'nick_edit_dist',
    'ir_score': 'ir_score',
    'published_rank_percentile': 'published_rank_percentile',
}
# columns that live only here
PRESERVED = ['id', 'target', 'edit', 'species', 'measured_efficiency',
             'pe_system', 'efficiency_source']


def read(path):
    with open(path, newline='', encoding='utf-8-sig') as fh:
        return list(csv.DictReader(fh))


join = read(JOIN)
canon = {r['id']: r for r in read(CANON)}

missing = [r['id'] for r in join if r['id'] not in canon]
if missing:
    sys.exit('REFUSING TO WRITE: %d id(s) are not in benchmark_scored.csv: %s'
             % (len(missing), ', '.join(missing[:6])))

lost = [r['id'] for r in join if not (r.get('measured_efficiency') or '').strip()]
if lost:
    sys.exit('REFUSING TO WRITE: %d row(s) carry no measured efficiency: %s'
             % (len(lost), ', '.join(lost[:6])))

header = list(join[0].keys())
missing_cols = [c for c in FROM_CANON if c not in header]
if missing_cols:
    sys.exit('REFUSING TO WRITE: join is missing column(s) %s' % missing_cols)

drift = {}
out = []
for r in join:
    c = canon[r['id']]
    new = dict(r)
    for col, src in FROM_CANON.items():
        old_v, new_v = (r.get(col) or '').strip(), (c.get(src) or '').strip()
        if old_v != new_v:
            drift.setdefault(col, []).append((r['id'], old_v, new_v))
        new[col] = new_v
    out.append(new)

print('rows                : %d' % len(out))
print('canonical source    : data/%s' % os.path.basename(CANON))
print('columns recomputed  : %s' % ', '.join(sorted(FROM_CANON)))
print('columns preserved   : %s' % ', '.join(PRESERVED))
if drift:
    print('\nDRIFT FOUND — the deposited join disagreed with the canonical benchmark:')
    for col, hits in sorted(drift.items()):
        print('  %-26s %3d row(s) differ   e.g. %s: %s -> %s'
              % (col, len(hits), hits[0][0], hits[0][1] or '(blank)', hits[0][2] or '(blank)'))
else:
    print('\nno drift: the join already agrees with the canonical benchmark')

if CHECK_ONLY:
    print('\n--check given: nothing written')
    sys.exit(1 if drift else 0)

with open(JOIN, 'w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=header, lineterminator='\r\n')
    w.writeheader()
    w.writerows(out)
print('\nwrote data/%s' % os.path.basename(JOIN))
