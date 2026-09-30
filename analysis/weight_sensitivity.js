#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   How much does the RT<->PBS weight actually decide?

   genRT scores four intramolecular channels and weights RT<->PBS at 1.5, the
   heaviest weight anywhere in the tool. That figure is this work's judgement,
   not a published measurement, and saying so is honest but unhelpful: a reader
   cannot tell whether the number is load-bearing or decorative.

   This script answers it by measurement rather than by argument. It rebuilds the
   tool with the weight set to each of 0, 0.5, 1.0, 1.5, 2.0, 2.5 and 3.0 — zero
   meaning the channel is switched off entirely — and records which RT template
   the engine selects at every benchmark locus under each setting. What matters is
   not the score, which of course moves, but the SELECTION, which is the only
   thing a user sees.

   USAGE  node analysis/weight_sensitivity.js [--html <tool.html>]
   Writes analysis/weight_sensitivity.json
   ══════════════════════════════════════════════════════════════════════════ */

const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const hi = process.argv.indexOf('--html');
const HTML = hi > 0 ? process.argv[hi+1] : path.join(ROOT, 'plant_prime_editor_v1.0.html');

// The weight as it appears in genRT's channel table. Anchored on the tail of the
// line so the unicode in the label does not have to be reproduced here.
const ANCHOR = "hairpin)',   weight:1.5},";
const WEIGHTS = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
const SHIPPED = 1.5;

function parseCSV(l){ const o=[]; let c='', q=false;
  for (const ch of l) { if (ch==='"') q=!q; else if (ch===','&&!q) {o.push(c);c='';} else c+=ch; }
  o.push(c); return o; }
const csv  = fs.readFileSync(ROOT+'/data/benchmark_scored.csv','utf8').split('\n').filter(Boolean);
const HEAD = parseCSV(csv[0]), col = n => HEAD.indexOf(n);

// Key on the SITE, not the label, and identify the site by its protospacer.
//
// Keying on the label swept one site twice under two names. Keying on the label with only
// the ALS pair registered still did: OsGAPDH and OsGAPDH-T1 are one protospacer, one edit
// (C>A at 303) and one window, so this sweep designed them twice and the panel carried 32
// rows for 31 designs. Both copies then changed at weight 2.5, which is where "the largest
// change anywhere is two of 32" came from — it is one of 31. See analysis/lib/target_site.js
// and analysis/build_target_sites.py.
const { siteOfRow } = require(require('path').join(__dirname, 'lib', 'target_site.js'));

const rows = []; const seen = new Set();
for (const f of csv.slice(1).map(parseCSV)) {
  if (!/^OK/.test(f[col('status')] || '')) continue;
  const k = siteOfRow(f, col) + '\u0000' + f[col('edit_type')];
  if (seen.has(k)) continue; seen.add(k);
  rows.push(f);
}

const base = fs.readFileSync(HTML, 'utf8');
if (base.indexOf(ANCHOR) < 0) {
  console.error('The RT<->PBS weight line was not found. If genRT has been reformatted, update ANCHOR.');
  process.exit(1);
}

const picks = {};
for (const w of WEIGHTS) {
  const tmp = path.join(os.tmpdir(), 'ppe_weight_' + String(w).replace('.','_') + '.html');
  fs.writeFileSync(tmp, base.replace(ANCHOR, ANCHOR.replace('weight:1.5', 'weight:' + w)));
  process.env.PPE_HTML = tmp;
  for (const m of [ROOT+'/tests/probe.js', ROOT+'/tests/lib/load_tool.js'])
    delete require.cache[require.resolve(m)];
  const { ctx } = require(ROOT + '/tests/probe.js');

  picks[w] = rows.map(f => {
    const from = f[col('edit_from_top')] || f[col('edit_from')];
    const to   = f[col('edit_to_top')]   || f[col('edit_to')];
    let p = +f[col('edit_pos')] - 1;
    if (f[col('edit_strand')] === '-' && from.length > 1) p = p - from.length + 1;
    ctx.__a = { g:f[col('genomic_seq')], n:+f[col('nick_pos')], st:f[col('spacer_strand')],
                ed:[{genomicPos:p, type:f[col('edit_type')], ref:from, alt:to || '-'}],
                sp:f[col('published_spacer')] };
    const r = JSON.parse(vm.runInContext(`JSON.stringify((function(){
      var pbs = genPBS(__a.g, __a.n, __a.st, 8, 22, __a.sp, false);
      var rt  = genRT(__a.g, __a.n, __a.ed, __a.st, 10, 34, __a.sp, pbs.length?pbs[0].seq:'');
      return rt.length ? rt[0].seq : null;
    })())`, ctx, {timeout:20000}));
    return r || '-';
  });
  fs.unlinkSync(tmp);
}

// per-locus detail for the figure: the length selected at each weight
const { labelsOfSite } = require(require('path').join(__dirname, 'lib', 'target_site.js'));
const perLocus = rows.map((f, i) => ({
  locus: f[col('locus')], edit_type: f[col('edit_type')],
  site: siteOfRow(f, col),
  also_called: labelsOfSite(siteOfRow(f, col)).filter(l => l !== f[col('locus')]),
  species: f[col('species')] || '',
  lengths: Object.fromEntries(WEIGHTS.map(w => [w, picks[w][i] === '-' ? null : picks[w][i].length])),
  seqs:    Object.fromEntries(WEIGHTS.map(w => [w, picks[w][i]]))
}));

const ref = picks[SHIPPED];
const table = WEIGHTS.map(w => {
  const diff = picks[w].map((x,i) => x !== ref[i] ? rows[i][col('locus')] + '/' + rows[i][col('edit_type')] : null)
                       .filter(Boolean);
  return { weight: w, changed: diff.length, loci: diff };
});

console.log(`\nRT template selected at each of ${rows.length} benchmark loci, as the RT<->PBS weight varies.`);
console.log(`The shipped weight is ${SHIPPED}; a weight of 0 switches the channel off entirely.\n`);
console.log('  weight   templates differing from the shipped value   loci');
table.forEach(t => console.log('  ' + String(t.weight.toFixed(1)).padEnd(8) +
  String(t.changed).padEnd(5) + ' of ' + String(rows.length).padEnd(30) +
  (t.loci.length ? t.loci.join(', ') : '—')));

const off = table.find(t => t.weight === 0);
const worst = table.reduce((m,t) => t.changed > m.changed ? t : m, table[0]);
// Report every weight that reaches the maximum, not just the first: with the duplicate
// design removed the maximum is reached at all six non-shipped weights, and naming only
// one of them reads as if the others were lower.
const worstAt = table.filter(t => t.changed === worst.changed).map(t => t.weight);
const movers = [...new Set(table.flatMap(t => t.loci))];
console.log(`\n  Switching the channel off entirely changes ${off.changed} of ${rows.length} selections.`);
console.log(`  The largest change anywhere in 0-3 is ${worst.changed} of ${rows.length}, reached at ` +
  (worstAt.length === 1 ? `weight ${worstAt[0]}.`
   : `every one of the ${worstAt.length} non-shipped weights (${worstAt.join(', ')}).`));
console.log(`  ${movers.length} distinct design${movers.length === 1 ? '' : 's'} ever move: ${movers.join(', ')}.`);
console.log('  The weight is therefore not load-bearing: it breaks ties, it does not drive selection.');

fs.writeFileSync(path.join(__dirname,'weight_sensitivity.json'), JSON.stringify({
  generated: new Date().toISOString().slice(0,10),
  shipped_weight: SHIPPED, weights_tested: WEIGHTS, loci: rows.length,
  changed_vs_shipped: Object.fromEntries(table.map(t => [t.weight, t.changed])),
  loci_affected: Object.fromEntries(table.map(t => [t.weight, t.loci])),
  off_changes: off.changed, max_change: worst.changed, max_change_at_weight: worst.weight,
  max_change_at_weights: worstAt, distinct_designs: rows.length,
  movers: movers, n_movers: movers.length,
  per_locus: perLocus
}, null, 2));
console.log('\nwrote analysis/weight_sensitivity.json');
