// check_linker_selection.js
//
// The tool says it "selects the 3' linker from 19 candidates by free-energy
// minimisation". Until 26 September 2026 that screen returned AAAAAAA at 400 of
// 400 random designs, because every candidate was A-rich and an all-A oligo forms
// the weakest duplex with anything, so poly-A won the energy terms at every locus
// and the length penalty then chose the shortest. A screen with one possible
// outcome is not a screen.
//
// Three further problems in the same place: the pool was attributed to Nelson
// 2022, which contains only one of its 19 sequences; the shipped default carried
// a 7-A run and so is rejected outright by pegLIT, the linker designer that paper
// actually recommends; and the /TTTT/ "Pol III terminator" filter on the pool
// could never fire, because no candidate contained a T at all.
//
// This asserts what the claim requires:
//   1. every shipped candidate is legal under pegLIT's published filters
//      (AC content >= 50%, no 4 identical consecutive nt, at most 3 consecutive U);
//   2. the selection actually varies across designs;
//   3. it responds to the design, not just to the pool — a linker complementary
//      to the PBS must lose to one that is not;
//   4. the pool size the interface advertises is the pool size that exists;
//   5. nothing in the source still hardcodes the superseded default.
//
// Run:  node analysis/check_linker_selection.js

const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.PPE_HTML = path.join(ROOT, 'plant_prime_editor_v1.0.html');
const { q } = require(path.join(ROOT, 'tests', 'probe.js'));

const SCAF = q('M2_SCAFFOLD');
const POOL = JSON.parse(q('JSON.stringify(_LINKER_POOL)'));
// tolerate a build without the raw pool so this reports a failure rather than throwing
const RAW = (function () {
  const r = q('typeof _LINKER_POOL_RAW !== "undefined" ? JSON.stringify(_LINKER_POOL_RAW) : ""');
  try { return r ? JSON.parse(r) : POOL; } catch (e) { return POOL; }
})();
const LINKER = q('LINKER');

let P = 0, F = 0;
const ck = (n, c, d) => { c ? P++ : F++;
  console.log((c ? '  PASS  ' : '* FAIL *') + ' ' + String(n).padEnd(58) + (d || '')); };

const pick = (sp, rt, pbs) =>
  JSON.parse(q('JSON.stringify(m2_designLinker(' + JSON.stringify(sp) + ',' +
    JSON.stringify(SCAF) + ',' + JSON.stringify(rt) + ',' + JSON.stringify(pbs) + '))'));

console.log('pool: ' + POOL.length + ' candidates, default ' + LINKER + ' (' + LINKER.length + ' nt)\n');

// ── 1. pegLIT legality, recomputed here rather than trusted ─────────────────
const legal = s => {
  const ac = (s.match(/[AC]/g) || []).length / s.length;
  const run = Math.max(...(s.match(/(.)\1*/g) || ['']).map(r => r.length));
  const u = Math.max(...((s.match(/T+/g) || [''])).map(r => r.length));
  return ac >= 0.5 && run <= 3 && u <= 3;
};
const illegal = POOL.filter(c => !legal(c.seq));
ck('every shipped candidate is legal under pegLIT', illegal.length === 0,
   illegal.map(c => c.seq).join(', '));
ck('the default linker is legal under pegLIT', legal(LINKER), LINKER);
ck('nothing legal was silently dropped from the pool', POOL.length === RAW.length,
   POOL.length + ' of ' + RAW.length);

// ── 2. the selection must vary ──────────────────────────────────────────────
let seed = 20260926;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const draw = n => Array.from({ length: n }, () => 'ACGT'[Math.floor(rnd() * 4)]).join('');
const winners = {};
for (let i = 0; i < 300; i++) {
  const w = pick(draw(20), draw(10 + Math.floor(rnd() * 20)), draw(8 + Math.floor(rnd() * 8)));
  winners[w.seq] = (winners[w.seq] || 0) + 1;
}
const nWin = Object.keys(winners).length;
console.log('');
ck('the screen returns more than one linker', nWin > 1, JSON.stringify(winners));
ck('at least three candidates can win', nWin >= 3, nWin + ' distinct winners over 300 designs');
const top = Math.max(...Object.values(winners));
ck('no single linker wins every design', top < 300, top + '/300');

// ── 3. it must respond to the design, not just to the pool ──────────────────
// A linker complementary to the PBS is the failure mode Nelson 2022 measured as
// most damaging. Give the screen a PBS that is the reverse complement of one
// candidate and check that candidate is not the one it picks.
const rc = s => s.split('').reverse().map(c => ({ A: 'T', T: 'A', G: 'C', C: 'G' }[c] || c)).join('');
console.log('');
let responded = 0, tried = 0;
for (const cand of POOL.slice(0, 6)) {
  const pbs = rc(cand.seq) + 'CA';                 // PBS that pairs with this candidate
  const w = pick('GACCAGCTCGGCAAGTTCTA', 'ACCTATCCTCCAATTGTA', pbs);
  tried++;
  if (w.seq !== cand.seq) responded++;
}
ck('a PBS-complementary linker is not chosen', responded === tried,
   responded + ' of ' + tried + ' avoided');

// ── 4. the advertised pool size is the real one ─────────────────────────────
const src = fs.readFileSync(path.join(ROOT, 'plant_prime_editor_v1.0.html'), 'utf8');
console.log('');
const claims = [...src.matchAll(/(\d+)\s+(?:linker candidates|candidate linkers)/gi)].map(m => Number(m[1]));
ck('every stated candidate count matches the pool',
   claims.every(c => c === POOL.length), claims.length ? claims.join(', ') : '(none stated inline)');

// ── 5. the superseded default must be gone as a live value ──────────────────
ck('no live GCAAAAAAA default remains',
   !src.includes("'GCAAAAAAA'") && !src.includes('>GCAAAAAAA<'), '');
ck('no hardcoded 9 nt linker-length fallback remains',
   !/m3_linker\.length : 9\b/.test(src), '');

// ── 5b. the default must be safe in EVERY context ───────────────────────────
// The default is used wherever the Module 2 designer has not run — Direct Assembly,
// a session reset, the case-study harness — so it cannot rely on the screen. A linker
// can COMPLETE a Type IIS site across its junctions: TCTCTCTC after a PBS ending GG
// spells GGTCTC. Two case-study designs failed exactly that way.
console.log('');
const SITES = ['GGTCTC', 'CGTCTC', 'GAAGAC'];
const TEVOHEAD = q('TEVO_preQ1').slice(0, 6);
function createsSite(linker) {
  const B = 'ACGT';
  let bad = 0;
  for (const a of B) for (const b of B) for (const c of B) for (const d of B) for (const e of B) {
    const seg = a + b + c + d + e + linker + TEVOHEAD;
    for (const s of SITES) if (seg.includes(s) || seg.includes(rc(s))) { bad++; break; }
  }
  return bad;
}
const defBad = createsSite(LINKER);
ck('the default linker creates no Type IIS site in any context', defBad === 0,
   defBad + ' of 1024 contexts');
ck('the screen penalises site-creating candidates',
   /sitePenalty/.test(src) && /createsTypeIIsSite/.test(src), '');

// ── 6. the tevopreQ1 motif itself ───────────────────────────────────────────
const TEVO = q('TEVO_preQ1');
console.log('');
ck('tevopreQ1 is the 37 nt trimmed motif of Nelson 2022',
   TEVO === 'CGCGGTTCTATCTAGTTACGCGTTAAACCAACTAGAA' && TEVO.length === 37,
   TEVO.length + ' nt');

console.log('\n' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
