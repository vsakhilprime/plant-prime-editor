// SUPERSEDED — replaced by recovery_permutation.py on 13 August 2026.
//
// This earlier version re-derived the ranking by re-scanning each target with the
// design engine, which produced a set of 25 sites that did not match the scored
// benchmark. Every benchmark statistic now comes from the single canonical file
// data/benchmark_scored.csv, built by analysis/merge_benchmark.py, so that the
// number of pegRNAs, the number of sites and the ranking statistics can never
// again be computed from different sets.
//
//   python3 analysis/merge_benchmark.py
//   python3 analysis/recovery_permutation.py
console.error('superseded — use: python3 analysis/recovery_permutation.py');
console.error('  The Python version is the one the paper uses: it is seeded (Random(20260813)),');
console.error('  it writes analysis/recovery_permutation.json, and its output is checked by');
console.error('  analysis/verify_manuscript_numbers.py. This file is kept only so a reader');
console.error('  following an old path lands on a message rather than a missing file.');
process.exit(1);
