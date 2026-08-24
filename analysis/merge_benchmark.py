#!/usr/bin/env python3
"""
Plant Prime Editor — assemble the canonical scored benchmark.

The rice and wheat rows and the tomato rows were scored in two passes and lived in
two files. Every statistic the manuscript reports about the benchmark must come from
one file, so this merges them and is the only thing that should ever produce the
scored set used downstream.

    python3 analysis/merge_benchmark.py

Reads   data/scored_rice_wheat.csv   (Lin et al. 2020, Lin et al. 2021)
        data/scored_tomato.csv       (Vu et al. 2024)
Writes  data/benchmark_scored.csv    the canonical set
        analysis/benchmark_merge.json  a record of what went in and what came out

The tomato pass carried three extra columns (n_edits, bases_validated, edit_text);
they are preserved and left empty for the rice and wheat rows rather than dropped,
so nothing scored is silently discarded.
"""
import csv, json, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
SRC = [
    ('rice_wheat', os.path.join(DATA, 'scored_rice_wheat.csv')),
    ('tomato',     os.path.join(DATA, 'scored_tomato.csv')),
]
OUT = os.path.join(DATA, 'benchmark_scored.csv')

parts, cols = [], []
for tag, path in SRC:
    with open(path, newline='', encoding='utf-8-sig') as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        r['_source_pass'] = tag
    parts.append((tag, path, rows))
    for c in (rows[0].keys() if rows else []):
        if c not in cols:
            cols.append(c)
if '_source_pass' not in cols:
    cols.append('_source_pass')

merged = [r for _, _, rows in parts for r in rows]

# a pegRNA id must not appear twice
ids = collections.Counter(r.get('id', '') for r in merged)
dupes = [k for k, v in ids.items() if v > 1 and k]
if dupes:
    raise SystemExit('duplicate pegRNA ids across the two passes: %s' % dupes[:10])

with open(OUT, 'w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=cols, extrasaction='ignore')
    w.writeheader()
    for r in merged:
        w.writerow({c: r.get(c, '') for c in cols})

loci = collections.Counter(r['locus'] for r in merged)
spec = collections.Counter(r['species'] for r in merged)
withpct = [r for r in merged if str(r.get('published_rank_percentile', '')).strip()]

rec = {
    'generated': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
    'inputs': [{'pass': t, 'file': os.path.basename(p), 'rows': len(rows)} for t, p, rows in parts],
    'output_file': os.path.basename(OUT),
    'pegRNAs': len(merged),
    'target_sites': len(loci),
    'species': dict(spec),
    'pegRNAs_with_a_rank_percentile': len(withpct),
    'sites': sorted(loci),
}
json.dump(rec, open(os.path.join(HERE, 'benchmark_merge.json'), 'w'), indent=2)

print('\nCANONICAL BENCHMARK SET')
for t, p, rows in parts:
    print('  %-11s %3d pegRNAs   %s' % (t, len(rows), os.path.basename(p)))
print('  ' + '-' * 46)
print('  merged      %3d pegRNAs at %d target sites' % (len(merged), len(loci)))
print('  species     %s' % ', '.join('%s %d' % (k, v) for k, v in sorted(spec.items())))
print('  with a published-design rank percentile: %d' % len(withpct))
print('\nwrote data/%s and analysis/benchmark_merge.json' % os.path.basename(OUT))
