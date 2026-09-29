// check_specificity_score.js
//
// A weighted term that cannot vary is not a term. Supplementary Table S4 gave the
// CFD mismatch weights 40% and the seed-weight concentration 15%, citing Doench 2016
// and Hsu 2013 — and both evaluate to the same number for every possible 20-mer,
// because the implementation takes the MAXIMUM mismatch weight at each position and
// the CFD matrix pins that maximum. avgCFDWeight was 0.340 and worstMMWeight 0.030
// for 20xA, 20xG, 20xT, 20xC and 4,006 random spacers alike. 62% of the weight did
// nothing, the score spanned 74–94 of its nominal 0–100, and 4,005 of 4,006 spacers
// came out labelled "High".
//
// Nothing compared the score's behaviour with the description of it. This does:
//
//   1. it measures the spread over a large sample and over adversarial extremes;
//   2. it asserts that every term the documentation says VARIES actually varies,
//      by holding the others fixed and moving one;
//   3. it asserts the labels partition the range the score can reach, rather than
//      collapsing onto one value;
//   4. it asserts the relaxed PAMs the interface offers are scored as LESS specific
//      than NGG — they were scored as more specific until 25 September 2026, because
//      the lookup key was built wrong and missed the table.
//
// Run:  node analysis/check_specificity_score.js

const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.PPE_HTML = path.join(ROOT, 'plant_prime_editor_v1.0.html');
const { q } = require(path.join(ROOT, 'tests', 'probe.js'));

const spec = (s, pam) =>
  JSON.parse(q('JSON.stringify(computeSpacerSpecificity(' +
    JSON.stringify(s) + ',' + JSON.stringify(pam || 'NGG') + '))'));

let P = 0, F = 0;
const ck = (name, cond, detail) => { cond ? P++ : F++;
  console.log((cond ? '  PASS  ' : '* FAIL *') + ' ' + String(name).padEnd(56) + (detail || '')); };

// ── a large, reproducible sample ────────────────────────────────────────────
let seed = 20260925;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const draw = () => Array.from({ length: 20 }, () => 'ACGT'[Math.floor(rnd() * 4)]).join('');
const sample = new Set();
while (sample.size < 2000) sample.add(draw());
const EXTREMES = ['A', 'C', 'G', 'T'].map(b => b.repeat(20))
  .concat(['GGGGACGTACGTACGTGGGG', 'AAAAACGTACGTACGTTTTT', 'ACGTACGTACGTACGTACGT']);
const all = [...sample, ...EXTREMES];

const res = all.map(s => spec(s));
const scores = res.map(r => r.score);
const lo = Math.min(...scores), hi = Math.max(...scores);
const distinct = new Set(scores).size;

console.log('sampled ' + all.length + ' spacers (2,000 pseudo-random + ' +
            EXTREMES.length + ' extremes)\n');
console.log('  score range ' + lo + '–' + hi + '   ' + distinct + ' distinct values\n');

// 1. the score must actually spread
ck('the score spans more than 10 points', hi - lo > 10, lo + '–' + hi);
ck('the score takes at least 8 distinct values', distinct >= 8, distinct);

// 2. the labels must partition what the score can reach
const labs = {};
res.forEach(r => { labs[r.label] = (labs[r.label] || 0) + 1; });
const used = Object.keys(labs);
ck('more than one label is ever produced', used.length > 1, JSON.stringify(labs));
ck('at least four of the five labels are reachable', used.length >= 4, used.join(', '));
const biggest = Math.max(...Object.values(labs));
ck('no single label swallows more than 80% of spacers',
   biggest / res.length <= 0.8, (100 * biggest / res.length).toFixed(1) + '%');

// 3. every term the documentation says varies must actually vary
console.log('');
const base = 'ACGTACGTACGTACGTACGT';                 // GC 50, no runs, no G-run
const cases = [
  ['GC band',                'ACGCGCGCGCGCGCGCGCGC'],  // GC 90 -> outside the band
  ['homopolymer runs',       'ACGTACGTAAAAACGTACGT'],  // AAAA
  ['PAM-proximal G-run',     'ACGTACGTACGTACGTGGGA'],  // GGG at 17-19
];
const b = spec(base).score;
for (const [name, variant] of cases) {
  const v = spec(variant).score;
  ck('the ' + name + ' term moves the score', v !== b, base + ' ' + b + '  vs  ' + variant + ' ' + v);
}

// the terms the documentation says are CONSTANT must in fact be constant, or the
// description has drifted the other way and Table S4 needs rewriting again
const cfd = new Set(res.map(r => r.avgCFDWeight));
ck('the CFD baseline is still constant, as Table S4 states',
   cfd.size === 1, [...cfd].slice(0, 4).join(', '));

// 4. relaxed PAMs must score as LESS specific than NGG
console.log('');
const nggScore = spec(base, 'NGG').score;
for (const pam of ['NG', 'NRN', 'NYN', 'NNGRRT']) {
  const s = spec(base, pam).score;
  ck('PAM ' + pam + ' scores below NGG', s < nggScore, pam + ' ' + s + '  vs  NGG ' + nggScore);
}

// 4b. THE PAM THE TOOL ACTUALLY PASSES
//
// Every assertion above passes a MOTIF, and that is how the 25 September PAM fix shipped a
// regression none of them caught. findSpacers does not pass a motif: it reads the three bases
// following the protospacer out of the sequence and passes those, so what this function
// receives in the tool is AGG, TGG, CGG, GGG, AGA. _CFD_PAM is keyed in N-prefixed motif
// form, so after that fix every one of them missed the table and fell to the permissive
// default -- pamActivity 50% for all of them, four points off every design in the catalogue,
// and a canonical AGG scoring identically to an NGA. build_equivalence.js found it by naming
// the field; these assertions are what should have.
console.log('');
const CONCRETE_NGG = ['AGG', 'TGG', 'CGG', 'GGG'];
for (const pam of CONCRETE_NGG) {
  const r = spec(base, pam), n = spec(base, 'NGG');
  ck('concrete PAM ' + pam + ' is scored as NGG is',
     r.score === n.score && r.pamActivity === n.pamActivity,
     pam + ' ' + r.score + '/' + r.pamActivity + '  vs  NGG ' + n.score + '/' + n.pamActivity);
}
// and the term must still discriminate: a concrete NGA is not a concrete NGG
const agg = spec(base, 'AGG'), aga = spec(base, 'AGA');
ck('a concrete NGA PAM is not scored as a concrete NGG',
   agg.pamActivity !== aga.pamActivity,
   'AGG ' + agg.pamActivity + '  vs  AGA ' + aga.pamActivity);
// resolving concrete PAMs must not rescue the relaxed motifs, which is what it replaced
for (const pam of ['NRN', 'NYN', 'NNGRRT']) {
  const r = spec(base, pam);
  ck('relaxed motif ' + pam + ' is still treated as permissive',
     r.score < spec(base, 'NGG').score, pam + ' ' + r.score + ' / ' + r.pamActivity);
}

// 5. the worked example keeps the label the captured screenshots show
console.log('');
const W = require(path.join(ROOT, 'analysis', 'worked_example.json'));
const w = spec(W.spacer);
ck('the worked example is still 94 / High', w.score === 94 && w.label === 'High',
   w.score + ' ' + w.label);
// and with the PAM it really carries, which is what the Supplementary reports
const wReal = spec(W.spacer, 'TGG');
ck('the worked example scores 94 / High on its OWN PAM too',
   wReal.score === 94 && wReal.label === 'High', 'TGG ' + wReal.score + ' ' + wReal.label);

// 6. the returned record must state which terms move and which do not
const r0 = res[0];
ck('the record names its varying terms', !!r0.varying_terms, r0.varying_terms || '');
ck('the record names its constant baseline', !!r0.constant_terms, '');
ck('the record does not claim CFD as its method',
   !/^CFD \(Doench 2016\) \+ MIT framework/.test(r0.method || ''), r0.method || '');

console.log('\n' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
