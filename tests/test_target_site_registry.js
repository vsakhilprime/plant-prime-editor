#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   One target site, however many studies numbered it.

   A SITE is a protospacer in a genomic window; a LABEL is a name a study gave it. They are
   not one-to-one in this deposit, and for a long time nothing said so. analysis/als_sites.json
   registered one pair of labels that name one protospacer and knew nothing of the other three,
   nor of the five labels that name two protospacers each. The consequences were quiet:

     * the 162-passing stage was reported as 33 target sites where there are 35;
     * the 141-scored stage as 26 where there are 27;
     * the 135-ranked stage as 25, which is right — by cancellation, not by counting;
     * the RT<->PBS weight sweep designed OsGAPDH twice under two names, so Figure 2D drew
       31 designs in 32 rows, and both copies moved at weight 2.5, which is the entirety of
       the old claim that "the largest change anywhere is two of 32";
     * the architecture sweep never designed the second SlOr protospacer at all.

   Nothing failed. Every count was self-consistent and wrong. This test exists so that the
   next label collision is a red line rather than a number nobody compares.

     node tests/test_target_site_registry.js
   ═══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'analysis', 'lib', 'target_site.js'));

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  PASS   ' + m); }
                          else { fail++; console.log('* FAIL * ' + m + (d ? '   ' + d : '')); } };

function readCSV(p) {
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
  const cut = l => { const o = []; let c = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; }
    o.push(c); return o; };
  const head = cut(lines[0]);
  return lines.slice(1).map(l => Object.fromEntries(cut(l).map((v, i) => [head[i], v])));
}
const md5 = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);

const SETS = [
  ['targets_verified.csv (162 passing)', readCSV(path.join(ROOT, 'data', 'targets_verified.csv'))
      .filter(r => /^OK/.test(r.status || '')), 'target_id', 'spacer'],
  ['benchmark_scored.csv (141 scored)',  readCSV(path.join(ROOT, 'data', 'benchmark_scored.csv')),
      'locus', 'published_spacer'],
];

console.log('--- the key must be unambiguous ---');
for (const [name, rows, , sp] of SETS) {
  const byWin = new Map();
  rows.forEach(r => {
    if (!r[sp] || !r.genomic_seq) return;
    if (!byWin.has(r[sp])) byWin.set(r[sp], new Set());
    byWin.get(r[sp]).add(md5(r.genomic_seq));
  });
  const bad = [...byWin].filter(([, w]) => w.size > 1).map(([s]) => s);
  ok(bad.length === 0, `${name}: every protospacer occupies exactly one genomic window`,
     bad.join(', '));
}

console.log('\n--- every label resolves, and every collision is registered ---');
for (const [name, rows, lab, sp] of SETS) {
  const same = new Map(), split = new Map();
  rows.forEach(r => {
    if (!r[sp]) return;
    if (!same.has(r[sp])) same.set(r[sp], new Set());
    same.get(r[sp]).add(r[lab]);
    if (!split.has(r[lab])) split.set(r[lab], new Set());
    split.get(r[lab]).add(r[sp]);
  });
  // a pair of labels on one protospacer must land on one site id
  const merges = [...same].filter(([, l]) => l.size > 1);
  const unmerged = merges.filter(([s, l]) =>
    new Set([...l].map(() => T.siteOfSpacer(s))).size !== 1 ||
    [...l].some(x => { try { return T.siteOf(x) !== T.siteOfSpacer(s); } catch (e) { return false; } }));
  ok(unmerged.length === 0,
     `${name}: each of the ${merges.length} label pairs sharing a protospacer resolves to one site`,
     unmerged.map(([s]) => s).join(', '));

  // a label on two protospacers must be refused by siteOf, not silently answered
  const splits = [...split].filter(([, s]) => s.size > 1).map(([l]) => l);
  const answered = splits.filter(l => { try { T.siteOf(l); return true; } catch (e) { return false; } });
  ok(answered.length === 0,
     `${name}: each of the ${splits.length} labels naming two protospacers is refused by siteOf`,
     answered.join(', '));

  // and the two protospacers must get different site ids
  const collapsed = [...split].filter(([, s]) => s.size > 1)
    .filter(([, s]) => new Set([...s].map(T.siteOfSpacer)).size !== s.size).map(([l]) => l);
  ok(collapsed.length === 0, `${name}: those labels' protospacers get distinct site ids`,
     collapsed.join(', '));
}

console.log('\n--- the registry is current ---');
const reg = T.registry();
ok(reg.sites.length === 35, `the registry holds 35 sites`, 'holds ' + reg.sites.length);
ok(new Set(reg.sites.map(s => s.id)).size === reg.sites.length, 'every site id is unique');
ok(new Set(reg.sites.map(s => s.spacer)).size === reg.sites.length,
   'every site carries a distinct protospacer');
ok(Object.keys(reg.ambiguous).length === 5,
   'five labels are recorded as naming two protospacers',
   Object.keys(reg.ambiguous).join(', '));

console.log('\n--- the analyses that count sites agree with it ---');
const sweep = JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis', 'architecture_sweep.json')));
ok(new Set(sweep.locus_list).size === sweep.locus_list.length,
   'the architecture sweep designs each site once, never twice');
ok(sweep.locus_list.length === sweep.loci, 'the sweep locus list matches its own count');
const ws = JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis', 'weight_sensitivity.json')));
const seen = new Set(ws.per_locus.map(r => r.site + '\u0000' + r.edit_type));
ok(seen.size === ws.per_locus.length,
   'the weight sweep carries no design twice',
   `${ws.per_locus.length} rows, ${seen.size} distinct`);
const bench = readCSV(path.join(ROOT, 'data', 'benchmark_scored.csv'));
const ranked = bench.filter(r => (r.published_rank_percentile || '').trim());
const perm = JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis', 'recovery_permutation.json')));
ok(new Set(ranked.map(r => T.siteOfSpacer(r.published_spacer))).size === perm.target_sites,
   `the design-recovery cohort spans ${perm.target_sites} sites, counted on the protospacer`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
