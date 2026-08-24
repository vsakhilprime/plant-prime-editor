#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — build equivalence harness

   Two builds of this tool can differ in ways that change what a user is told
   without changing what the tool computes. PPE_BUILD.fingerprint hashes the
   scorers' source text, comments included, so it moves for either kind of
   change and cannot tell them apart. This script can.

   It loads two builds side by side, runs the whole design surface on both, and
   diffs the results field by field, holding advisory text apart from computed
   values. It exists because on 22 August 2026 a citation audit found that a
   number of scoring parameters were credited to papers that do not contain them.
   Correcting the ones inside findSpacers, genPBS and genRT moved the fingerprint
   eight times — 572c4104 -> 3909f4db -> c4329cff -> 2c0e07c8 -> ecc037b8 ->
   599b7773 -> 4c5446f2 -> 46a53cfb -> 96e270bb — because the hash covers those functions' source text, comments
   included. The claim that accompanies every one of those moves — that not one
   designed sequence, length, score or temperature changed — is the sort of claim
   that should be demonstrated rather than asserted.

   Against the 572c4104 release build this script reports 100,547 computed fields
   across 411 cases, 0 differing, and 155 cases differing on advisory text alone.

   WHAT IT DOES NOT COVER, stated so "0 differing" is not read as more than it is.
   The corpus below exercises the DESIGN surface: findSpacers, genPBS, genRT,
   genNickSgRNA, smartRecommend and the shared constants. It does not call
   runPrimerDesign, and it does not build the gBlock, the cloning primers or the
   bench protocol. A change confined to Module 3's cloning outputs therefore shows
   0 differing here and is still a real change — that is exactly what happened on
   23 August 2026 when the gBlock's restriction sites were corrected from BsaI to
   the vector's own enzyme. tests/test_gblock_and_scorers.js and
   tests/test_primer_roundtrip.js are what guard that side.

   USAGE
     node analysis/build_equivalence.js <old.html> [new.html]

   Exit status 0 means every computed value matched.
   ═══════════════════════════════════════════════════════════════════════════ */

const path = require('path');
const fs = require('fs');
const vm = require('vm');

const HERE = __dirname;
const OLD = process.argv[2];
const NEW = process.argv[3] || path.join(HERE, '..', 'plant_prime_editor_v1.0.html');
if (!OLD) { console.error('usage: node analysis/build_equivalence.js <old.html> [new.html]'); process.exit(2); }

function load(htmlPath) {
  process.env.PPE_HTML = path.resolve(htmlPath);
  const mod = require.resolve('../tests/lib/load_tool.js');
  delete require.cache[mod];
  const saved = console.log;
  console.log = () => {};                    // the loader narrates every block
  const { ctx } = require(mod);
  console.log = saved;
  return ctx;
}

const run = (ctx, expr, arg) => { ctx.__a = arg; return vm.runInContext(expr, ctx, { timeout: 60000 }); };

/* ── the corpus: every benchmark locus, every architecture ─────────────────── */

const seqDir = path.join(HERE, '..', 'data', 'sequences_plain');
const loci = fs.readdirSync(seqDir).filter(f => f.endsWith('.txt')).map(f => ({
  name: f.replace(/\.txt$/, ''),
  seq: fs.readFileSync(path.join(seqDir, f), 'utf8').trim()
}));

const csv = fs.readFileSync(path.join(HERE, '..', 'data', 'benchmark_scored.csv'), 'utf8').split('\n');
const header = csv[0].split(',');
const iSeq = header.indexOf('genomic_seq'), iPos = header.indexOf('edit_pos');
const iFrom = header.indexOf('edit_from'), iTo = header.indexOf('edit_to'), iId = header.indexOf('id');
const bench = [];
const seenSeq = new Set();
for (const line of csv.slice(1)) {
  const f = line.split(',');
  if (f.length < header.length || !f[iSeq] || !/^[ACGT]+$/.test(f[iSeq])) continue;
  const key = f[iSeq].slice(0, 40) + f[iPos];
  if (seenSeq.has(key)) continue;
  seenSeq.add(key);
  bench.push({ id: f[iId], seq: f[iSeq], pos: parseInt(f[iPos], 10), from: f[iFrom], to: f[iTo] });
}
for (const l of loci) if (!bench.some(b => b.seq === l.seq)) bench.push({ id: l.name, seq: l.seq, pos: 300, from: l.seq[299], to: 'A' });

const ARCH = ['PE2', 'PE2max', 'PE3', 'PE3b', 'PE4', 'PE5', 'PE5b', 'twinPE', 'ePPE', 'PPE', 'ePPE3'];
const PRIORITIES = ['balanced', 'simple', 'maximum'];
const PLANTS = [['monocot', 'rice'], ['monocot', 'wheat'], ['dicot', 'tomato'], ['dicot', 'arabidopsis']];

/* ── what counts as advisory rather than computed ──────────────────────────── */

// WHAT COUNTS AS ADVISORY
//
// Two corrections, both found by the harness being wrong rather than by reading it.
//
// 'warns' was missing until 22 Aug 2026. The nicking-sgRNA designer names its advisory
// field `warns` rather than `warnings`, so four poly-T warning strings were compared as
// computed values and reported as a behavioural difference when only their citation had
// changed. The harness was right to flag them; the classifier was wrong about what they
// were.
//
// The opposite error, found on 23 Aug 2026 and far more serious: `structDetails` and
// `otDetails` were in this set. They are not text. structDetails is what m2_structRisk
// returns per interaction channel — {label, run, dG, sev, weight} — a base-pair run
// length, a free energy in kcal/mol, the scoring weight itself, and the severity band.
// Only `label` is prose. Because the walk below skips an advisory key at any depth, that
// whole subtree left the computed comparison. Changing the severity band inside
// m2_structRisk from -5 to -0.5 kcal/mol then produced:
//
//     cases differing on a computed value : 0
//     cases differing on advisory text only : 194
//     RESULT: the two builds compute identical results.
//
// A scoring change touching 194 of 411 cases, reported as identical. The classification
// is now per LEAF, not per subtree: inside these containers, `label` is advisory and
// every number is computed.
const ADVISORY = new Set(['warnings', 'warns', 'spWarns', 'warning', 'advice', 'note', 'notes',
                          'details', 'otDetails', 'label', 'otLabel',
                          'otColor', 'color', 'bg', 'txtC', 'src']);

// Containers whose CHILDREN must be classified individually rather than skipped whole.
// Anything reached inside one of these is compared as a computed value unless its own
// key is in ADVISORY.
//
// structDetails only. otDetails is a different shape: computeSpacerSpecificity builds it
// with details.push(`...`), so it is an array of plain sentences with no numeric leaves —
// descending into it would compare prose as a computed value, which is the same mistake in
// the other direction. The two names look alike and are not.
const DESCEND = new Set(['structDetails']);

function split(obj) {
  const hard = [], soft = [];
  (function walk(o, p) {
    if (o === null || typeof o !== 'object') { hard.push(p + '=' + JSON.stringify(o)); return; }
    if (Array.isArray(o)) { o.forEach((v, i) => walk(v, p + '[' + i + ']')); return; }
    for (const k of Object.keys(o).sort()) {
      if (DESCEND.has(k)) { walk(o[k], p + '.' + k); continue; }
      if (ADVISORY.has(k)) { soft.push(p + '.' + k + '=' + JSON.stringify(o[k])); continue; }
      walk(o[k], p + '.' + k);
    }
  })(obj, '');
  return { hard, soft };
}

/* ── collect every result from one build ──────────────────────────────────── */

function collect(ctx) {
  const out = {};
  for (const b of bench) {
    const ed = [{ genomicPos: b.pos, type: 'SNP', ref: b.from || b.seq[b.pos - 1], alt: b.to || 'A' }];
    let sp;
    try {
      sp = run(ctx, 'findSpacers(__a.s,"NGG",20,__a.e,__a.ed)', { s: b.seq, e: b.pos, ed });
    } catch (e) { out['spacers:' + b.id] = { err: e.message }; continue; }
    out['spacers:' + b.id] = sp;
    for (const strand of ['+', '-']) {
      try {
        out['spacers:' + b.id + ':' + strand] =
          run(ctx, 'findSpacers(__a.s,"NGG",20,__a.e,__a.ed,{strand:__a.st})',
              { s: b.seq, e: b.pos, ed, st: strand });
      } catch (e) { out['spacers:' + b.id + ':' + strand] = { err: e.message }; }
    }
    const top = sp && sp[0];
    if (!top) continue;
    const np = top.nickPosGenomic, st = top.strand;
    try {
      const pbs = run(ctx, 'genPBS(__a.s,__a.np,__a.st,8,22,__a.sp,false)',
                      { s: b.seq, np, st, sp: top.spacer });
      out['pbs:' + b.id] = pbs;
      const topPBS = pbs && pbs[0] ? pbs[0].seq : '';
      out['rt:' + b.id] = run(ctx, 'genRT(__a.s,__a.np,__a.ed,__a.st,10,30,__a.sp,__a.pbs)',
                              { s: b.seq, np, ed, st, sp: top.spacer, pbs: topPBS });
    } catch (e) { out['pbsrt:' + b.id] = { err: e.message }; }
    for (const nk of ['PE3', 'PE3b']) {
      try {
        out['nick:' + b.id + ':' + nk] =
          run(ctx, 'genNickSgRNA(__a.s,__a.np,__a.st,__a.ed,"NGG",20,__a.k)',
              { s: b.seq, np, st, ed, k: nk });
      } catch (e) { out['nick:' + b.id + ':' + nk] = { err: e.message }; }
    }
  }
  for (const a of ARCH) for (const [pl, org] of PLANTS) for (const pr of PRIORITIES) {
    try {
      out['vec:' + a + ':' + pl + ':' + org + ':' + pr] =
        run(ctx, 'smartRecommend(__a.a,__a.p,__a.o,__a.r)', { a, p: pl, o: org, r: pr });
    } catch (e) { out['vec:' + a + ':' + pl + ':' + org + ':' + pr] = { err: e.message }; }
  }
  out['const:scaffold'] = vm.runInContext('M2_SCAFFOLD', ctx);
  out['const:tevo'] = vm.runInContext('TEVO_preQ1', ctx);
  out['const:polyT'] = vm.runInContext('POLY_T_TERM', ctx);
  out['const:scaf3'] = vm.runInContext('_M2_SCAF_3', ctx);
  // PBS_TM_BANDS carries a `src` field per species — a citation string, not a band.
  // Stringifying the whole object made that citation a COMPUTED field, so correcting a
  // citation there would have been reported as a behavioural difference. The bands are
  // compared; the citations are handed to the advisory side.
  out['const:tmbands'] = JSON.parse(vm.runInContext('JSON.stringify(PBS_TM_BANDS)', ctx));
  out['const:vectors'] = vm.runInContext('JSON.stringify(VECTORS.map(function(v){return [v.id,v.enzyme,v.overhang_5,v.overhang_3,v.supplies_3prime].join("|")}))', ctx);
  return out;
}

/* ── run both, diff ───────────────────────────────────────────────────────── */

const ctxOld = load(OLD);
const fpOld = vm.runInContext('PPE_BUILD.fingerprint', ctxOld);
const resOld = collect(ctxOld);

const ctxNew = load(NEW);
const fpNew = vm.runInContext('PPE_BUILD.fingerprint', ctxNew);
const resNew = collect(ctxNew);

console.log('old build : ' + path.basename(OLD) + '   fingerprint ' + fpOld);
console.log('new build : ' + path.basename(NEW) + '   fingerprint ' + fpNew);
console.log('cases     : ' + Object.keys(resOld).length + '\n');

const keys = new Set([...Object.keys(resOld), ...Object.keys(resNew)]);
let hardDiff = 0, softDiff = 0, hardFields = 0, softFields = 0;
const softExamples = [];

for (const k of [...keys].sort()) {
  const a = split(resOld[k] === undefined ? null : resOld[k]);
  const b = split(resNew[k] === undefined ? null : resNew[k]);
  const ha = a.hard.join('\n'), hb = b.hard.join('\n');
  hardFields += a.hard.length;
  if (ha !== hb) {
    hardDiff++;
    console.log('COMPUTED VALUE DIFFERS: ' + k);
    const A = a.hard, B = b.hard;
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      if (A[i] !== B[i]) { console.log('   old ' + (A[i] || '(absent)')); console.log('   new ' + (B[i] || '(absent)')); break; }
    }
  }
  softFields += a.soft.length;
  if (a.soft.join('\n') !== b.soft.join('\n')) {
    softDiff++;
    if (softExamples.length < 6) {
      const A = a.soft, B = b.soft;
      for (let i = 0; i < Math.max(A.length, B.length); i++) {
        if (A[i] !== B[i]) { softExamples.push({ k, old: A[i], nw: B[i] }); break; }
      }
    }
  }
}

console.log('computed fields compared : ' + hardFields);
console.log('cases differing on a computed value : ' + hardDiff);
console.log('advisory fields compared : ' + softFields);
console.log('cases differing on advisory text only : ' + softDiff);
if (softExamples.length) {
  console.log('\nadvisory text that changed (first ' + softExamples.length + '):');
  for (const e of softExamples) {
    console.log('  ' + e.k);
    console.log('    old ' + String(e.old).slice(0, 150));
    console.log('    new ' + String(e.nw).slice(0, 150));
  }
}
console.log('\n' + (hardDiff === 0
  ? 'RESULT: the two builds compute identical results. Only advisory text differs.'
  : 'RESULT: ' + hardDiff + ' case(s) differ on a COMPUTED VALUE — the builds are NOT equivalent.'));
process.exit(hardDiff === 0 ? 0 : 1);
