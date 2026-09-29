#!/usr/bin/env python3
"""
Re-run every analysis that stores its result, and say whether the stored result still holds.

The manuscript quotes numbers out of these JSON files, and the files are only as current as
the last time someone remembered to re-run the script that wrote them. That is the same
failure mode as a figure built from a frozen literal: the number is checkable in principle
and unchecked in practice. This runs each one against the current build and diffs.

    python3 analysis/rerun_all_analyses.py [--keep]

Exit status is non-zero if a script fails to run. A result that CHANGED is reported, not
treated as a failure — it may be a correction working as intended — but it must then be
propagated to the manuscript, which analysis/verify_manuscript_numbers.py will catch.
"""
import argparse, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument('--keep', action='store_true')
a = ap.parse_args()

# script -> the JSON it writes (in analysis/)
ANALYSES = [
    ('case studies',            ['node', 'analysis/case_studies.js'],            'case_studies.json'),
    ('architecture sweep',      ['node', 'analysis/architecture_sweep.js'],      'architecture_sweep.json'),
    ('weight sensitivity',      ['node', 'analysis/weight_sensitivity.js'],      'weight_sensitivity.json'),
    ('homology falsifiability', ['node', 'analysis/homology_falsifiability.js'], 'homology_falsifiability.json'),
    ('efficiency prediction',   ['node', 'analysis/efficiency_prediction.js'],   'efficiency_prediction.json'),
    # recovery_permutation.js is a deliberate tombstone pointing at the Python version,
    # which is the one the paper uses: seeded Random(20260813), and its output is checked
    # by verify_manuscript_numbers.py. Running the .js is not a failure, it is a redirect.
    ('recovery permutation',    ['python3', 'analysis/recovery_permutation.py'],  'recovery_permutation.json'),
    ('window sensitivity',      ['python3', 'analysis/window_sensitivity.py'],    'window_sensitivity.json'),
]

# NOT re-runnable as a check: analysis/merge_benchmark.py is a PIPELINE STAGE. It rewrites
# data/benchmark_scored.csv from the merge sources, which drops every column the scorer adds
# — including edit_from_top and edit_to_top — so running it alone leaves the benchmark in a
# half-built state. It was briefly in the list above, and running it did exactly that: the
# deposited benchmark lost its top-strand columns and tests/audit_mnp.js went from 23 passed
# to 21 passed, 2 failed. Rebuilding the benchmark means running BOTH stages, in order:
#
#     python3 analysis/merge_benchmark.py                       # assemble the rows
#     node analysis/score_batch_v2.js data/benchmark_scored.csv \
#          > /tmp/rescored.csv && mv /tmp/rescored.csv data/benchmark_scored.csv
#
# and then re-running everything downstream. That is a deliberate act, not a check, so it is
# not done here. What IS checked here is the scored benchmark's agreement with the engine,
# by tests/audit_mnp.js, which re-derives every substitution row's template independently.
PIPELINE_ONLY = [
]


def walk(a, b, path=''):
    """Yield readable differences between two JSON structures."""
    if type(a) is not type(b):
        yield '%s: %s -> %s' % (path or '(root)', type(a).__name__, type(b).__name__); return
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k in ('generated', 'generated_on', 'date', 'timestamp'): continue
            if k not in a: yield '%s.%s added' % (path, k)
            elif k not in b: yield '%s.%s removed' % (path, k)
            else: yield from walk(a[k], b[k], '%s.%s' % (path, k))
    elif isinstance(a, list):
        if len(a) != len(b):
            yield '%s: %d entries -> %d' % (path or '(root)', len(a), len(b)); return
        for i, (x, y) in enumerate(zip(a, b)):
            yield from walk(x, y, '%s[%d]' % (path, i))
    elif a != b:
        yield '%s: %r -> %r' % (path or '(root)', a, b)


print('Re-running every stored analysis against the current build.\n')
same, moved, failed, skipped = [], [], [], []
for name, cmd, out in ANALYSES:
    target = os.path.join(HERE, out)
    if not os.path.exists(os.path.join(ROOT, cmd[1])):
        skipped.append('%s: %s not in the deposit' % (name, cmd[1])); continue
    stash = None
    if os.path.exists(target):
        stash = tempfile.mktemp(suffix='.json'); shutil.copy(target, stash)
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        tail = (r.stderr or r.stdout).strip().splitlines()[-1:] or ['no output']
        failed.append('%s: %s' % (name, tail[0])); print('  %-24s RUN FAILED  %s' % (name, tail[0][:70]))
        if stash: shutil.copy(stash, target)
        continue
    if stash is None:
        print('  %-24s written for the first time' % name); same.append(name); continue
    try:
        d = list(walk(json.load(open(stash)), json.load(open(target))))
    except Exception as e:
        failed.append('%s: %s' % (name, e)); print('  %-24s COMPARE FAILED  %s' % (name, e)); continue
    if d:
        moved.append((name, d)); print('  %-24s CHANGED  (%d difference(s))' % (name, len(d)))
        for x in d[:6]: print('        ' + x[:150])
    else:
        same.append(name); print('  %-24s unchanged' % name)
    if not a.keep and stash: shutil.copy(stash, target)

print('\n%d unchanged, %d changed, %d failed, %d skipped'
      % (len(same), len(moved), len(failed), len(skipped)))
for s in skipped: print('  skipped  ' + s)
for f in failed:  print('  FAILED   ' + f)
sys.exit(1 if failed else 0)
