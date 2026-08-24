#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — does the score predict measured editing efficiency?

   The benchmark reported in the manuscript asks a weaker question: where does the
   platform rank the design the original authors chose. That shows agreement with
   expert judgement, but published designs are not necessarily optimal — the authors
   picked one, it worked, and no alternative was tried. A referee is entitled to ask
   whether the score tracks the outcome.

   Lin et al. 2021 (Nat Biotechnol 39:923) answered a different question in a way that
   makes this testable: at fourteen rice targets they built primer-binding sites of
   several lengths and measured editing efficiency for each. That gives a within-target
   series in which everything except the primer-binding site is held constant.

   Method
     - For each target the real genomic context, spacer, strand and nick position are
       taken from the benchmark, and genPBS is run across 5–17 nt. Regenerated sequences
       must match the published ones exactly; a target where they do not is dropped
       rather than fudged.
     - Correlation is computed WITHIN each target and then combined. Pooling across
       targets would mostly measure differences in baseline efficiency between loci —
       OsCDC48-T3 edits at 10% and OsROC5-T1 at 0.1%, so a pooled correlation would be
       dominated by which locus a design belongs to rather than by the score.
     - The null shuffles efficiencies within each target, which preserves both the
       per-target baseline and the set of scores.

   Reports the result whichever way it falls.

     node analysis/efficiency_prediction.js [--html path]
   Writes analysis/efficiency_prediction.json
   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const HERE = __dirname;
const htmlArg = process.argv.indexOf('--html');
process.env.PPE_HTML = htmlArg > 0 ? process.argv[htmlArg + 1]
                                   : path.join(HERE, '..', 'plant_prime_editor_v1.0.html');
const { ctx, q } = require(path.join(HERE, '..', 'tests', 'probe.js'));

function readCsv(f) {
  const txt = fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim();
  const lines = txt.split(/\r?\n/);
  const hdr = splitCsv(lines[0]);
  return lines.slice(1).map(l => { const c = splitCsv(l), o = {}; hdr.forEach((h, i) => o[h] = c[i]); return o; });
}
function splitCsv(l) {
  const out = []; let cur = '', inq = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (ch === '"') { if (inq && l[i + 1] === '"') { cur += '"'; i++; } else inq = !inq; }
    else if (ch === ',' && !inq) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}

const tm = readCsv(path.join(HERE, '..', 'data', 'tm_table.csv'));
const bm = readCsv(path.join(HERE, '..', 'data', 'benchmark_scored.csv'));

const context = {};
bm.forEach(r => { if (r.locus && r.genomic_seq && !context[r.locus]) context[r.locus] = r; });

const byTarget = {};
tm.forEach(r => { (byTarget[r.target_id] = byTarget[r.target_id] || []).push(r); });

// ── rank correlation ──────────────────────────────────────────────────────
function ranks(v) {
  const idx = v.map((x, i) => i).sort((a, b) => v[a] - v[b]);
  const r = new Array(v.length); let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}
function spearman(x, y) {
  if (x.length < 3) return null;
  const rx = ranks(x), ry = ranks(y), n = x.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return (dx && dy) ? num / Math.sqrt(dx * dy) : null;
}
const median = a => { const s = a.slice().sort((x, y) => x - y); const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

// ── score each measured design with the engine ────────────────────────────
//
// Two ways to give the engine a context.
//
//   real          the locus, spacer, strand and nick position recorded in the benchmark
//   reconstructed a synthetic window built so that genPBS regenerates exactly the published
//                 primer-binding sites. All 74 sites nest as prefixes of the longest one at
//                 their target, which is what the geometry predicts: on the plus strand
//                 PBS(n) = revcomp(g[nick-n .. nick]), so adding a base extends the 3' end.
//                 Inverting that gives g[nick-L .. nick] = revcomp(longest site), and the rest
//                 of the window is padding the primer-binding site never reaches.
//
// The reconstruction cannot supply the spacer, so the intramolecular PBS-spacer term is
// missing from those scores. Rather than assume that does not matter, both context types are
// run on the targets where the real one exists and the two are compared below.
const PAD = 'GTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTAC';
function rcSeq(x) { return x.split('').reverse().map(ch => ({A:'T',T:'A',G:'C',C:'G'}[ch] || ch)).join(''); }

function scoreOne(genomic, nick, strand, spacer, L) {
  const one = JSON.parse(vm.runInContext(
    `JSON.stringify(genPBS(${JSON.stringify(genomic)}, ${nick}, ${JSON.stringify(strand)}, ${L}, ${L}, ${JSON.stringify(spacer || '')}, true)
      .map(function(x){return {len:(x.len||x.length||(x.seq||'').length), seq:x.seq, score:x.score};}))`, ctx));
  return one.length ? one[0] : null;
}

function buildSeries(t, mode) {
  const meas = byTarget[t].slice().sort((a, b) => a.pbs_length - b.pbs_length);
  let genomic, nick, strand, spacer;
  if (mode === 'real') {
    const c = context[t];
    if (!c) return { skip: 'no genomic context in the benchmark' };
    strand = (c.spacer_strand || '').trim();
    nick = parseInt(c.nick_pos, 10);
    if (!strand || !Number.isFinite(nick)) return { skip: 'no strand or nick position recorded' };
    genomic = c.genomic_seq.toUpperCase(); spacer = c.published_spacer || '';
  } else {
    const longest = meas.reduce((a, b) => b.pbs_seq.length > a.pbs_seq.length ? b : a).pbs_seq.toUpperCase();
    genomic = PAD + rcSeq(longest) + PAD;
    nick = PAD.length + longest.length; strand = '+'; spacer = '';
  }
  const rows = [], dropped = [];
  meas.forEach(r => {
    const L = parseInt(r.pbs_length, 10), eff = parseFloat(r.efficiency);
    if (!Number.isFinite(L) || !Number.isFinite(eff)) { dropped.push(r.pbs_length + ':bad row'); return; }
    const cand = scoreOne(genomic, nick, strand, spacer, L);
    if (!cand) { dropped.push(L + ':engine returned nothing'); return; }
    if (cand.seq.toUpperCase() !== r.pbs_seq.toUpperCase()) { dropped.push(L + ':sequence mismatch'); return; }
    rows.push({ len: L, seq: cand.seq, score: cand.score, efficiency: eff });
  });
  // A single length that fails to reproduce is a defect in that one digitised row, not a
  // reason to discard the whole series. Losing more than a fifth of a target is.
  if (rows.length < 3) return { skip: 'fewer than three reproducible lengths', dropped: dropped };
  if (dropped.length > meas.length * 0.25) return { skip: 'more than a quarter of the lengths did not reproduce', dropped: dropped };
  const rho = spearman(rows.map(r => r.score), rows.map(r => r.efficiency));
  const best = rows.reduce((a, b) => b.efficiency > a.efficiency ? b : a);
  const pick = rows.reduce((a, b) => b.score > a.score ? b : a);
  const bestAll = meas.reduce((a, b) => parseFloat(b.efficiency) > parseFloat(a.efficiency) ? b : a);
  return { target: t, mode: mode, n: rows.length, dropped: dropped, rho: rho,
    best_measured_len: best.len, best_measured_eff: best.efficiency,
    best_of_all_measured_eff: parseFloat(bestAll.efficiency),
    top_scoring_len: pick.len, top_scoring_eff: pick.efficiency,
    fraction_of_best: parseFloat(bestAll.efficiency) ? pick.efficiency / parseFloat(bestAll.efficiency) : null,
    length_error_nt: Math.abs(pick.len - best.len), rows: rows };
}

const targets = Object.keys(byTarget).sort();
const realRuns = {}, reconRuns = {};
targets.forEach(t => { realRuns[t] = buildSeries(t, 'real'); reconRuns[t] = buildSeries(t, 'reconstructed'); });

// control: where both are available, do they agree?
const bothOk = targets.filter(t => !realRuns[t].skip && !reconRuns[t].skip);
const agreement = bothOk.map(t => ({
  target: t, real_rho: realRuns[t].rho, reconstructed_rho: reconRuns[t].rho,
  difference: (realRuns[t].rho !== null && reconRuns[t].rho !== null) ? +(reconRuns[t].rho - realRuns[t].rho).toFixed(3) : null,
}));

// primary set: the real context wherever it exists, the reconstruction elsewhere
const series = [], skipped = [];
targets.forEach(t => {
  const chosen = !realRuns[t].skip ? realRuns[t] : reconRuns[t];
  if (chosen.skip) { skipped.push({ target: t, why: chosen.skip, dropped: chosen.dropped || [] }); return; }
  series.push(chosen);
});

// ── combine ───────────────────────────────────────────────────────────────
const rhos = series.map(s => s.rho).filter(r => r !== null);
const obsMedian = median(rhos);
const nPos = rhos.filter(r => r > 0).length;

// permutation: shuffle efficiencies within each target
let rng = 20260813;
const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const N = 20000; let ge = 0;
const nullMedians = [];
for (let it = 0; it < N; it++) {
  const perTarget = series.map(s => {
    const eff = s.rows.map(r => r.efficiency);
    for (let i = eff.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = eff[i]; eff[i] = eff[j]; eff[j] = t; }
    return spearman(s.rows.map(r => r.score), eff);
  }).filter(r => r !== null);
  const m = median(perTarget);
  nullMedians.push(m);
  if (m >= obsMedian) ge++;
}
const p = (ge + 1) / (N + 1);
nullMedians.sort((a, b) => a - b);

const fracs = series.map(s => s.fraction_of_best).filter(x => x !== null);
const out = {
  question: 'Does the primer-binding-site score predict measured editing efficiency?',
  data_source: 'Lin Q et al. 2021 Nat Biotechnol 39:923, primer-binding-site length series, digitised in data/tm_table.csv',
  design: 'within-target Spearman between the engine score and measured efficiency, combined across targets; null shuffles efficiencies within each target',
  targets_analysed: series.length,
  designs_analysed: series.reduce((a, s) => a + s.n, 0),
  targets_skipped: skipped,
  context_control: agreement,
  per_target: series.map(({ rows, ...rest }) => rest),
  combined: {
    median_rho: obsMedian === null ? null : +obsMedian.toFixed(3),
    positive_targets: nPos, of: rhos.length,
    null_median_rho: +median(nullMedians).toFixed(3),
    null_95th: +nullMedians[Math.floor(0.95 * N)].toFixed(3),
    p_value: p, p_reported: p <= 1 / (N + 1) ? '< 5e-5' : p.toPrecision(3),
  },
  top_pick_performance: {
    median_fraction_of_best_efficiency: +median(fracs).toFixed(3),
    median_length_error_nt: median(series.map(s => s.length_error_nt)),
    exact_length_hits: series.filter(s => s.length_error_nt === 0).length,
    within_2nt: series.filter(s => s.length_error_nt <= 2).length,
  },
};
fs.writeFileSync(path.join(HERE, 'efficiency_prediction.json'), JSON.stringify(out, null, 1));

const pct = x => (100 * x).toFixed(0) + '%';
console.log('\nDOES THE SCORE PREDICT MEASURED EFFICIENCY?');
console.log('  source           : Lin et al. 2021 primer-binding-site length series (digitised)');
console.log('  targets analysed : ' + out.targets_analysed + '    designs: ' + out.designs_analysed);
skipped.forEach(s2 => console.log('    skipped ' + s2.target.padEnd(14) + s2.why +
  (s2.dropped && s2.dropped.length ? '  [' + s2.dropped.join(', ') + ']' : '')));

console.log('\n  ' + 'target'.padEnd(14) + 'ctx'.padEnd(6) + 'n'.padStart(3) + '   ' + 'rho'.padStart(6) +
            '   ' + 'best measured'.padEnd(20) + 'top scoring'.padEnd(20) + 'of best');
series.forEach(s2 => console.log('  ' + s2.target.padEnd(14) +
  (s2.mode === 'real' ? 'real' : 'recon').padEnd(6) +
  String(s2.n).padStart(3) + '   ' +
  (s2.rho === null ? 'n/a' : s2.rho.toFixed(2)).padStart(6) + '   ' +
  (s2.best_measured_len + ' nt (' + s2.best_measured_eff.toFixed(2) + '%)').padEnd(20) +
  (s2.top_scoring_len + ' nt (' + s2.top_scoring_eff.toFixed(2) + '%)').padEnd(20) +
  (s2.fraction_of_best === null ? 'n/a' : pct(s2.fraction_of_best))));

console.log('\n  CONTROL - real context versus reconstructed, where both are possible');
agreement.forEach(a => console.log('    ' + a.target.padEnd(14) +
  'real ' + (a.real_rho === null ? 'n/a' : a.real_rho.toFixed(2)) +
  '   reconstructed ' + (a.reconstructed_rho === null ? 'n/a' : a.reconstructed_rho.toFixed(2)) +
  '   difference ' + (a.difference === null ? 'n/a' : a.difference)));

const c = out.combined, tp = out.top_pick_performance;
console.log('\n  median within-target rho : ' + c.median_rho + '   (positive at ' + c.positive_targets + ' of ' + c.of + ' targets)');
console.log('  null median              : ' + c.null_median_rho + '   95th percentile ' + c.null_95th);
console.log('  P                        : ' + c.p_reported);
console.log('\n  the top-scoring design reaches a median ' + pct(tp.median_fraction_of_best_efficiency) +
            ' of the best efficiency measured at its target');
console.log('  length error: median ' + tp.median_length_error_nt + ' nt, exact at ' +
            tp.exact_length_hits + ' of ' + series.length + ' targets, within 2 nt at ' + tp.within_2nt);
console.log('\nwrote analysis/efficiency_prediction.json');
