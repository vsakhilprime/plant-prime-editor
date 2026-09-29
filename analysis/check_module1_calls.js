// check_module1_calls.js
//
// Module 1 turns two sequences into a list of differences with an amino-acid consequence for
// each. Those consequences are the output a breeder acts on, so they are checked here the only
// way that settles anything: against an independently written genetic code, against the
// published BLOSUM62 matrix, and by applying known edits and asking the tool to recover them.
//
//   1. The genetic code, all 64 codons, against a table written out here from the standard
//      code rather than copied from the tool.
//
//   2. The conservative/non-conservative grouping, against BLOSUM62's own off-diagonal positive
//      pairs computed here from the matrix. Until 27 September 2026 the set carried two pairs
//      the matrix scores ZERO — H<->Q and N<->Q — while the comment above it stated the rule as
//      "score > 0" and the provenance as "generated from the BLOSUM62 matrix". His->Gln and
//      Asn->Gln were reported Conservative.
//
//   3. The SAME grouping in the Python reimplementation this tool emits as a downloadable
//      script. Two copies of one table in two languages is the shape this codebase keeps
//      producing; they are asserted equal.
//
//   4. Round-trip: apply a known edit, recover it. Position, type, reference base and variant
//      base must all come back.
//
//   5. A frameshift must be named. An indel whose net length change is not a multiple of three
//      shifts the frame, and the tool used to report the result as up to 75 independent
//      amino-acid substitutions with no advisory and nothing distinguishing it from an in-frame
//      indel's two. Prime editing is often used precisely to create or repair a frameshift.
//
// Run:  node analysis/check_module1_calls.js

const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.PPE_HTML = path.join(ROOT, 'plant_prime_editor_v1.0.html');
const { q } = require(path.join(ROOT, 'tests', 'probe.js'));
const src = fs.readFileSync(path.join(ROOT, 'plant_prime_editor_v1.0.html'), 'utf8');

const J = e => JSON.parse(q('JSON.stringify(' + e + ')'));
const S = x => JSON.stringify(x);

let P = 0, F = 0;
const ck = (n, c, d) => { c ? P++ : F++;
  console.log((c ? '  PASS  ' : '* FAIL *') + ' ' + String(n).padEnd(56) + (d || '')); };

// ── 1. the genetic code ─────────────────────────────────────────────────────
// Written from the standard code, in TCAG order, not copied from the tool.
const STD = {};
{
  const b = 'TCAG';
  const aas = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  let k = 0;
  for (const a of b) for (const c of b) for (const d of b) STD[a + c + d] = aas[k++];
}
const T = J('CODON_TABLE');
const wrong = Object.keys(STD).filter(c => T[c] !== STD[c]);
const missing = Object.keys(STD).filter(c => !(c in T));
const extra = Object.keys(T).filter(c => !(c in STD));
ck('all 64 codons match the standard genetic code', wrong.length === 0,
   wrong.slice(0, 4).map(c => c + ' table=' + T[c] + ' std=' + STD[c]).join('  '));
ck('no codon is missing and none is extra', missing.length === 0 && extra.length === 0,
   missing.length + ' missing, ' + extra.length + ' extra');

// ── 2. the conservative grouping against BLOSUM62 ──────────────────────────
// The matrix, written out here.
const B62 = [
  'A R N D C Q E G H I L K M F P S T W Y V',
  'A  4 -1 -2 -2  0 -1 -1  0 -2 -1 -1 -1 -1 -2 -1  1  0 -3 -2  0',
  'R -1  5  0 -2 -3  1  0 -2  0 -3 -2  2 -1 -3 -2 -1 -1 -3 -2 -3',
  'N -2  0  6  1 -3  0  0  0  1 -3 -3  0 -2 -3 -2  1  0 -4 -2 -3',
  'D -2 -2  1  6 -3  0  2 -1 -1 -3 -4 -1 -3 -3 -1  0 -1 -4 -3 -3',
  'C  0 -3 -3 -3  9 -3 -4 -3 -3 -1 -1 -3 -1 -2 -3 -1 -1 -2 -2 -1',
  'Q -1  1  0  0 -3  5  2 -2  0 -3 -2  1  0 -3 -1  0 -1 -2 -1 -2',
  'E -1  0  0  2 -4  2  5 -2  0 -3 -3  1 -2 -3 -1  0 -1 -3 -2 -2',
  'G  0 -2  0 -1 -3 -2 -2  6 -2 -4 -4 -2 -3 -3 -2  0 -2 -2 -3 -3',
  'H -2  0  1 -1 -3  0  0 -2  8 -3 -3 -1 -2 -1 -2 -1 -2 -2  2 -3',
  'I -1 -3 -3 -3 -1 -3 -3 -4 -3  4  2 -3  1  0 -3 -2 -1 -3 -1  3',
  'L -1 -2 -3 -4 -1 -2 -3 -4 -3  2  4 -2  2  0 -3 -2 -1 -2 -1  1',
  'K -1  2  0 -1 -3  1  1 -2 -1 -3 -2  5 -1 -3 -1  0 -1 -3 -2 -2',
  'M -1 -1 -2 -3 -1  0 -2 -3 -2  1  2 -1  5  0 -2 -1 -1 -1 -1  1',
  'F -2 -3 -3 -3 -2 -3 -3 -3 -1  0  0 -3  0  6 -4 -2 -2  1  3 -1',
  'P -1 -2 -2 -1 -3 -1 -1 -2 -2 -3 -3 -1 -2 -4  7 -1 -1 -4 -3 -2',
  'S  1 -1  1  0 -1  0  0  0 -1 -2 -2  0 -1 -2 -1  4  1 -3 -2 -2',
  'T  0 -1  0 -1 -1 -1 -1 -2 -2 -1 -1 -1 -1 -2 -1  1  5 -2 -2  0',
  'W -3 -3 -4 -4 -2 -2 -3 -2 -2 -3 -2 -3 -1  1 -4 -3 -2 11  2 -3',
  'Y -2 -2 -2 -3 -2 -1 -2 -3  2 -1 -1 -2 -1  3 -3 -2 -2  2  7 -1',
  'V  0 -3 -3 -3 -1 -2 -2 -3 -3  3  1 -2  1 -1 -2 -2  0 -3 -1  4',
];
const hdr = B62[0].split(/\s+/);
const positive = new Set();
for (const row of B62.slice(1)) {
  const p = row.trim().split(/\s+/), aa = p[0];
  p.slice(1).forEach((v, j) => {
    const bb = hdr[j];
    if (aa !== bb && Number(v) > 0) positive.add(aa + bb);
  });
}
const tool = new Set(J('Array.from(BLOSUM62_POSITIVE_PAIRS)'));
const notInTool = [...positive].filter(p => !tool.has(p));
const notPositive = [...tool].filter(p => !positive.has(p));
console.log('');
ck('every BLOSUM62-positive pair is treated as conservative', notInTool.length === 0,
   notInTool.sort().join(','));
ck('no zero- or negative-scoring pair is treated as conservative', notPositive.length === 0,
   notPositive.sort().join(','));
ck('the pair set is symmetric',
   [...tool].every(p => tool.has(p[1] + p[0])), tool.size + ' ordered pairs');
// the two that used to be wrong, named so a regression is unmistakable
ck('His↔Gln is not conservative (BLOSUM62 scores it 0)',
   q('aaImpact("H","Q")') === 'Non-conservative', q('aaImpact("H","Q")'));
ck('Asn↔Gln is not conservative (BLOSUM62 scores it 0)',
   q('aaImpact("N","Q")') === 'Non-conservative', q('aaImpact("N","Q")'));
ck('Asp↔Glu and His↔Asn still are',
   q('aaImpact("D","E")') === 'Conservative' && q('aaImpact("H","N")') === 'Conservative', '');

// ── 3. the JavaScript and Python copies must agree ─────────────────────────
console.log('');
const pyList = (src.match(/for _p in \[([^\]]+)\]/) || [, ''])[1]
  .split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
const jsList = (src.match(/const pairs = \[\s*([\s\S]*?)\];/) || [, ''])[1]
  .split(/[,\n]/).map(x => x.trim()).filter(x => /^'[A-Z]{2}'$/.test(x))
  .map(x => x.replace(/'/g, ''));
ck('the JavaScript and Python pair lists are identical',
   pyList.length > 0 && jsList.length > 0 &&
   pyList.slice().sort().join(',') === jsList.slice().sort().join(','),
   'JS ' + jsList.length + ' pairs, Python ' + pyList.length + ' pairs');

// ── 4. round-trip an applied edit ──────────────────────────────────────────
console.log('');
let seed = 20260927;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const draw = n => Array.from({ length: n }, () => 'ACGT'[Math.floor(rnd() * 4)]).join('');
const analyse = (ref, alt) =>
  J('runJSAnalysis(' + S([{ name: 'Ref', seq: ref }, { name: 'Var', seq: alt }]) + ',0,false)');

let subOK = 0, subN = 0, delOK = 0, delN = 0, insOK = 0, insN = 0, insShift = [];
for (let t = 0; t < 240; t++) {
  const L = 300 + Math.floor(rnd() * 20) * 3;
  const ref = draw(L);
  const p = 30 + Math.floor(rnd() * (L - 80));
  const kind = t % 3;
  if (kind === 0) {
    const from = ref[p], to = 'ACGT'.replace(from, '')[Math.floor(rnd() * 3)];
    const r = analyse(ref, ref.slice(0, p) + to + ref.slice(p + 1));
    subN++;
    if ((r.nt_variants || []).some(v => v.type === 'SNP' && v.position === p + 1 &&
        v.ref === from && v.var === to)) subOK++;
  } else if (kind === 1) {
    const alt = ref.slice(0, p) + ref.slice(p + 3);
    const r = analyse(ref, alt);
    delN++;
    // An indel inside a repeat is placeable at more than one position, and the aligner shifts it
    // within that window. Position proximity is the wrong test: what must hold is that the
    // reported deletion DESCRIBES THE SAME ALLELE as the one applied. Measured over 80 cases,
    // none is lost and every shifted placement reconstructs the identical sequence.
    const d = (r.nt_variants || []).filter(v => /Del/i.test(v.type))[0];
    if (d) {
      const asReported = ref.slice(0, d.position - 1) + ref.slice(d.position - 1 + 3);
      if (asReported === alt) delOK++;
      else insShift.push('del ' + (p + 1) + '->' + d.position + ' (different allele)');
    }
  } else {
    const ins = draw(3);
    const r = analyse(ref, ref.slice(0, p) + ins + ref.slice(p));
    insN++;
    const hit = (r.nt_variants || []).find(v => /Insert/i.test(v.type));
    if (hit && Math.abs(hit.position - (p + 1)) <= 1) insOK++;
    // an indel inside a repeat is placeable at more than one position; that is ambiguity,
    // not error, so it is counted separately and only a LOST insertion fails
    else if (hit) insShift.push(p + 1 + '->' + hit.position);
  }
}
ck('every substitution round-trips exactly', subOK === subN, subOK + ' / ' + subN);
ck('every in-frame deletion recovers the same allele', delOK === delN,
   delOK + ' / ' + delN + (delOK === delN ? ' (placement may shift inside a repeat; the allele does not)' : ''));
ck('no insertion is lost', insOK + insShift.length === insN,
   insOK + ' exact, ' + insShift.length + ' shifted within a repeat, ' + insN + ' applied');

// ── 5. a frameshift must be named ─────────────────────────────────────────
console.log('');
const fref = draw(300);
const cases = [
  ['a 1 nt insertion', fref.slice(0, 100) + 'G' + fref.slice(100), true],
  ['a 2 nt deletion', fref.slice(0, 100) + fref.slice(102), true],
  ['a 4 nt insertion', fref.slice(0, 100) + 'GGGG' + fref.slice(100), true],
  ['a 3 nt deletion', fref.slice(0, 100) + fref.slice(103), false],
  ['a 6 nt insertion', fref.slice(0, 100) + 'GGGGGG' + fref.slice(100), false],
];
let fsFail = [];
for (const [label, alt, shifts] of cases) {
  const r = analyse(fref, alt);
  const adv = (r.advisories || []).some(x => /Frameshift/i.test(x));
  const av = r.aa_variants || [];
  const marked = av.filter(v => v.frameshift).length;
  if (adv !== shifts) fsFail.push(label + ': advisory ' + adv + ', expected ' + shifts);
  if (shifts && marked !== av.length)
    fsFail.push(label + ': ' + (av.length - marked) + ' of ' + av.length +
                ' records still read as independent changes');
  if (!shifts && marked !== 0) fsFail.push(label + ': ' + marked + ' records wrongly marked');
}
ck('a frameshift is named and an in-frame indel is not', fsFail.length === 0,
   fsFail.slice(0, 3).join('; ') || cases.length + ' cases');
// and the two must be distinguishable by their record count, which is the symptom that
// sent us looking in the first place
const fsR = analyse(fref, fref.slice(0, 100) + 'G' + fref.slice(100));
const inR = analyse(fref, fref.slice(0, 100) + fref.slice(103));
ck('the frameshift advisory names the codon it starts at',
   (fsR.advisories || []).some(x => /from codon \d+/.test(x)),
   ((fsR.advisories || []).find(x => /Frameshift/.test(x)) || '').slice(0, 74) + '…');
ck('an in-frame indel reports only the residues it spans',
   (inR.aa_variants || []).length <= 3 && (fsR.aa_variants || []).length > 20,
   'in frame ' + (inR.aa_variants || []).length + ' records, frameshift ' +
   (fsR.aa_variants || []).length);

console.log('\n' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
