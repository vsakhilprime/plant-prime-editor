// check_module2_design.js
//
// Module 2 designs the molecule. These are the mechanical questions that were not being asked
// of it, each one written after a defect the 27 September 2026 audit found and each one failing
// on the build before that audit.
//
//   1. Edits are written into the template by one walk over the window, so no index can shift
//      under another edit. Until this audit three splice passes mutated one array while
//      computing indices against a different version of it, and a design carrying BOTH an
//      insertion and a deletion removed the wrong genomic base — an ordered oligo installing a
//      different allele. Checked against an independent reference implementation.
//
//   2. The homology beyond the farthest edit is measured, not assumed. It was a constant
//      len - 1 for every deletion, because deletions recorded no position and the fallback read
//      a `nickToFarthest` that was out of scope, and it overstated by altLen-1 for every
//      plus-strand multi-base substitution. So the 5 nt rule the interface states was unenforced
//      and unwarned for two whole edit classes.
//
//   3. A multi-base edit that would straddle the nick is refused on BOTH strands. The minus
//      strand accepted one and installed part of it, top-ranked and unpenalised.
//
//   4. A malformed edit is refused rather than silently yielding a wild-type template.
//
//   5. The CFD PAM table is keyed on the nuclease the user chose, not on the bases the tool
//      happened to read. Keying on the read re-interpreted SaCas9 and SpRY PAMs as SpCas9
//      motifs, so a whole label band turned on the fifth PAM base and SpCas9-NG — the most
//      permissive setting — scored as specific as canonical NGG.
//
//   6. Nick-to-nick distance is the distance between two CUTS. The two strands label the cut
//      with different coordinates, so subtracting two nickPos values across strands was off by
//      one in opposite directions either side of the pegRNA nick.
//
//   7. A spacer that cannot be ordered is not offered, and no GC% is diluted by ambiguous bases.
//
//   8. Every off-target field a renderer reads is present at every spacer length the interface
//      allows, and all twelve dinucleotide repeat classes are screened.
//
//   9. A widened template range is declared on the candidates the user actually sees.
//
// Run:  node analysis/check_module2_design.js

const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.PPE_HTML = path.join(ROOT, 'plant_prime_editor_v1.0.html');
const { ctx, q } = require(path.join(ROOT, 'tests', 'probe.js'));
const src = fs.readFileSync(path.join(ROOT, 'plant_prime_editor_v1.0.html'), 'utf8');

const J = e => JSON.parse(q('JSON.stringify(' + e + ')'));
const S = x => JSON.stringify(x);
const rc = s => s.split('').reverse().map(c => ({ A: 'T', T: 'A', G: 'C', C: 'G' }[c] || c)).join('');

let P = 0, F = 0;
const ck = (n, c, d) => { c ? P++ : F++;
  console.log((c ? '  PASS  ' : '* FAIL *') + ' ' + String(n).padEnd(56) + (d || '')); };

let seed = 20260927;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const draw = n => Array.from({ length: n }, () => 'ACGT'[Math.floor(rnd() * 4)]).join('');

const SP = 'ACGTACGTACGTACGTACGT', PBS0 = 'CACCACCATA';
const rt = (seq, nick, edits, strand, lo, hi) =>
  J('genRT(' + S(seq) + ',' + nick + ',' + S(edits) + ',' + S(strand) + ',' + lo + ',' + hi +
    ',' + S(SP) + ',' + S(PBS0) + ')');

// ── 1 + 2. an independent reference for the edited window ───────────────────
// Built here from the genomic coordinates alone, with no reference to how the tool does it.
function reference(seq, nick, edits, strand, len) {
  const start = strand === '+' ? nick : nick - len + 1;
  const end = start + len;
  if (start < 0 || end > seq.length) return null;
  const sub = new Map(), del = new Set(), ins = new Map();
  for (const e of edits) {
    const alt = (!e.alt || e.alt === '-') ? '' : String(e.alt);
    const ref = (!e.ref || e.ref === '-') ? '' : String(e.ref);
    if (alt && alt.length > ref.length) { ins.set(e.genomicPos, alt); continue; }
    if (!alt) { for (let d = 0; d < Math.max(1, ref.length); d++) del.add(e.genomicPos + d); continue; }
    for (let k = 0; k < alt.length; k++) sub.set(e.genomicPos + k, alt[k]);
  }
  const out = [], marks = [];
  for (let g = start; g < end; g++) {
    const i = ins.get(g);
    if (i) for (const ch of i) { out.push(ch); marks.push(out.length - 1); }
    if (del.has(g)) { marks.push(Math.max(0, out.length - 1)); continue; }
    const s2 = sub.get(g);
    out.push(s2 !== undefined ? s2 : seq[g]);
    if (s2 !== undefined) marks.push(out.length - 1);
  }
  const last = out.length - 1;
  const pos5 = [...new Set(marks.map(j => strand === '+' ? last - j : j))].filter(p => p >= 0)
    .sort((x, y) => x - y);
  return { seq: strand === '+' ? rc(out.join('')) : out.join(''), hom: pos5.length ? Math.min(...pos5) : null };
}

let seqFail = [], homFail = [], cases = 0;
for (let trial = 0; trial < 500; trial++) {
  const seq = draw(300);
  const strand = rnd() < 0.5 ? '+' : '-';
  const nick = 120 + Math.floor(rnd() * 40);
  const off = 3 + Math.floor(rnd() * 14);
  const p = strand === '+' ? nick + off : nick - off;
  const kind = Math.floor(rnd() * 4);
  let edits;
  if (kind === 0) edits = [{ genomicPos: p, ref: seq[p], alt: seq[p] === 'A' ? 'T' : 'A' }];
  else if (kind === 1) edits = [{ genomicPos: p, ref: seq.slice(p, p + 3), alt: 'TTT', genomicEnd: p + 2 }];
  else if (kind === 2) edits = [{ genomicPos: p, ref: '-', alt: 'GG', _isInsertion: true, genomicEnd: p }];
  else edits = [{ genomicPos: p, ref: seq[p], alt: '-' }];
  // and, for a quarter of trials, an insertion AND a deletion together — the combination the
  // three splice passes got wrong
  if (rnd() < 0.25) {
    const p2 = strand === '+' ? p + 4 : p - 4;
    edits = [{ genomicPos: Math.min(p, p2), ref: '-', alt: 'TT', _isInsertion: true, genomicEnd: Math.min(p, p2) },
             { genomicPos: Math.max(p, p2), ref: seq[Math.max(p, p2)], alt: '-' }];
  }
  const got = rt(seq, nick, edits, strand, 20, 20);
  // When the requested range cannot reach the farthest edited base genRT widens it, so the
  // returned candidates are no longer the 20 nt window this reference builds. Those cases are
  // covered by the widening assertion further down; here we compare like with like.
  if (got.length !== 1) continue;
  cases++;
  const want = reference(seq, nick, edits, strand, 20);
  if (!want) continue;
  if (got[0].seq !== want.seq) seqFail.push(strand + ' nick' + nick + ' kind' + kind);
  if (want.hom !== null && got[0].homologyBeyondEdit !== want.hom)
    homFail.push(strand + ' nick' + nick + ' kind' + kind + ' tool ' + got[0].homologyBeyondEdit + ' ref ' + want.hom);
}
console.log('compared ' + cases + ' designs against an independent reference\n');
ck('every edited template matches the reference', seqFail.length === 0,
   seqFail.slice(0, 3).join('; ') || cases + ' designs');
ck('every homology figure matches the reference', homFail.length === 0,
   homFail.slice(0, 3).join('; '));

// the homology number must not be a function of length alone
const DSEQ = draw(300);
const delRun = rt(DSEQ, 120, [{ genomicPos: 138, ref: DSEQ[138], alt: '-' }], '+', 10, 30);
ck('a deletion’s homology is not just length - 1',
   delRun.length > 0 && !delRun.every(c => c.homologyBeyondEdit === c.length - 1),
   delRun.map(c => c.length + ':' + c.homologyBeyondEdit).join(' '));

// ── 3. a straddling multi-base edit is refused on both strands ──────────────
console.log('');
let strFail = [];
for (let t = 0; t < 120; t++) {
  const seq = draw(300), nick = 140 + Math.floor(rnd() * 20);
  // an MNP whose span crosses the cut, expressed for each strand
  for (const strand of ['+', '-']) {
    const p = strand === '+' ? nick - 1 : nick - 1;
    const e = [{ genomicPos: p, ref: seq.slice(p, p + 3), alt: 'TTT', genomicEnd: p + 2 }];
    if (rt(seq, nick, e, strand, 14, 20).length) strFail.push(strand + ' nick' + nick);
  }
}
ck('a multi-base edit straddling the nick is refused on both strands', strFail.length === 0,
   strFail.slice(0, 3).join('; '));

// ── 4. a malformed edit is refused ─────────────────────────────────────────
const bad = rt(DSEQ, 120, [{ pos: 130, type: 'SNP', from: 'A', to: 'T' }], '+', 10, 34);
ck('an edit with no genomicPos yields no template', bad.length === 0, bad.length + ' candidates');

// ── 5. the PAM table is keyed on the chosen nuclease ───────────────────────
console.log('');
const PSEQ = 'ACGTGCAGCTTCAGGCATCGACGTAGCTAGGCTTGGACGTACGTTGAATCGTACGTAAGGTTGAGTCC' +
             'AAGGCATCGATTGGATCGTACGGTTGGGTACGTAGCTAGCTTAGG';
const byMotif = {};
for (const pam of ['NGG', 'NG', 'NNGRRT', 'NRN', 'NYN']) {
  const r = J('findSpacers(' + S(PSEQ) + ',' + S(pam) + ',20,60,null)');
  byMotif[pam] = { acts: [...new Set(r.map(x => x.otMeta && x.otMeta.pamActivity))],
                   labs: [...new Set(r.map(x => x.otLabel))] };
}
ck('one PAM activity per nuclease, not one per read',
   Object.values(byMotif).every(v => v.acts.length === 1),
   Object.entries(byMotif).map(([k, v]) => k + '=' + v.acts.join('/')).join('  '));
ck('NGG is the only setting that reaches the top band',
   byMotif.NGG.labs.includes('High') &&
   ['NG', 'NNGRRT', 'NRN', 'NYN'].every(m => !byMotif[m].labs.includes('High')),
   Object.entries(byMotif).map(([k, v]) => k + ':' + v.labs.join(',')).join('  '));
// a concrete SpCas9 read still resolves when no motif is supplied (direct callers, tests)
const conc = ['AGG', 'TGG', 'CGG', 'GGG'].map(p => J('computeSpacerSpecificity(' + S(SP) + ',' + S(p) + ')').pamActivity);
ck('a bare concrete NGG read still resolves to 100%',
   conc.every(x => x === '100%'), conc.join(','));

// ── 6. nick-to-nick is a distance between cuts ─────────────────────────────
console.log('');
let distFail = [], distN = 0;
for (let t = 0; t < 60; t++) {
  const seq = draw(400);
  const pegs = J('findSpacers(' + S(seq) + ',"NGG",20,190,null)').filter(s => s.strand === '+');
  if (!pegs.length) continue;
  const peg = pegs[0];
  const ng = J('genNickSgRNA(' + S(seq) + ',' + peg.nickPosGenomic + ',"+",' +
               S([{ genomicPos: 190, ref: seq[190], alt: 'T' }]) + ',"NGG",20,"PE3")');
  for (const c of ng) {
    distN++;
    const boundary = c.strand === '-' ? c.nickPos + 1 : c.nickPos;
    if (Math.abs(boundary - peg.nickPosGenomic) !== c.nickDist)
      distFail.push(c.strand + ' ' + c.nickPos + ' reported ' + c.nickDist);
  }
}
ck('every nick distance is the separation of the two cuts', distFail.length === 0,
   distFail.slice(0, 3).join('; ') || distN + ' candidates');
ck('no raw cross-strand nick subtraction remains in the source',
   !/Math\.abs\(nickPos2 - pegNickPos\)/.test(src) && !/Math\.abs\(np2 - nickPos\)/.test(src), '');

// ── 7. a spacer that cannot be ordered is not offered ──────────────────────
console.log('');
const NSEQ = 'ACGTGCAGCTTCAGGCATCGNNNNNNNNNNGGCATCGACGTAGCTAGGCTTGGACGTACGTACGTACGTACGTACGT';
const nres = J('findSpacers(' + S(NSEQ) + ',"NGG",20,55,null)');
ck('no spacer containing an ambiguous base is returned',
   !nres.some(s => /[^ACGT]/.test(s.spacer)), nres.length + ' candidates, none with N');

// ── 8. the off-target record is complete at every allowed length ───────────
console.log('');
let otFail = [];
const FIELDS = ['riskLevel', 'score', 'seed', 'seedGC', 'maxPolyRun', 'seedSelfComp', 'fullGC', 'crispor_url'];
for (let L = 17; L <= 24; L++) {
  const o = J('offTargetRisk(' + S(draw(L)) + ')');
  for (const f of FIELDS) if (!(f in o)) otFail.push(L + ' nt missing ' + f);
}
const stub = J('offTargetRisk("ACGTACGT")');
for (const f of FIELDS) if (!(f in stub)) otFail.push('8 nt stub missing ' + f);
ck('every off-target field a renderer reads is always present', otFail.length === 0,
   otFail.slice(0, 3).join('; '));
ck('an unassessable spacer says so rather than reading as low risk',
   stub.riskLevel === 'unknown' && (stub.warnings || []).length > 0,
   stub.riskLevel + ', ' + (stub.warnings || []).length + ' warning(s)');
const reps = ['AT', 'TA', 'GC', 'CG', 'AC', 'CA', 'GT', 'TG', 'AG', 'GA', 'CT', 'TC'];
const undetected = reps.filter(d => {
  const o = J('offTargetRisk(' + S(d.repeat(10)) + ')');
  return !(o.warnings || []).some(w => /complexity|repeat/i.test(w));
});
ck('all twelve dinucleotide repeat classes are screened', undetected.length === 0,
   undetected.length ? 'undetected: ' + undetected.join(',') : '12 of 12');

// ── 9. a widened range is declared where the user reads the design ─────────
console.log('');
ck('design() passes the user’s own template ceiling to genRT',
   /rtRegen = genRT\([^)]*, 1, rtMax,/.test(src), '');
let widened = null;
for (let t = 0; t < 40 && !widened; t++) {
  const seq = draw(300);
  const sp = J('findSpacers(' + S(seq) + ',"NGG",20,150,null)')
    .filter(s => s.isCorrectSide && s.strand === '+' && s.dist >= 25 && s.dist <= 40);
  if (!sp.length) continue;
  const c = J('genRT(' + S(seq) + ',' + sp[0].nickPosGenomic + ',' +
              S([{ genomicPos: 150, ref: seq[150], alt: 'T' }]) + ',"+",10,20,' +
              S(sp[0].spacer) + ',' + S(PBS0) + ')');
  if (c.length) widened = c;
}
ck('a widened range warns on every candidate it returns',
   !!widened && widened.every(c => (c.warnings || []).some(w => /extended past the/.test(w))),
   widened ? widened.length + ' candidates, all warned' : 'no widening case found');

// ── the pair check reaches somewhere a reader looks ────────────────────────
ck('the RT/primer-binding-site pair check is surfaced',
   /pairCheckWarnings:/.test(src), '');

console.log('\n' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
