// check_module3_primers.js
//
// A primer is a molecule, not a string. The only questions worth asking of one are
// mechanical, and none of the 32 tests in tests/ asked them of Module 3's alternative
// cloning routes or of its second pegRNA cassette. So:
//
//   1. Does the primer's 3' terminus occur in the template it has to prime?
//      A polymerase extends from the 3' end. If the annealing block is anywhere else
//      the primer does nothing, and the sequence on screen looks entirely reasonable.
//      Until 27 September 2026 three primers failed this on every vector —
//      P_BsmBI_Rev, P_Esp3I_Rev and P11_pegRNA2_RT2PBS2_Rev — because their argument
//      to m3_rc() began with the terminator rather than the scaffold overlap, and
//      m3_rc reverses the order of the blocks it is given.
//
//   2. Does the declared annealing region match the primer's actual 3' end?
//      That field drives the CSV's annealing-region and GC columns, the Tm and the QC
//      verdict. P_Gibson_Fwd and P_Esp3I_Fwd named the spacer where the primer ends
//      with scaffold nt 1-20, so P_Esp3I_Fwd reported 53.7 C where the byte-identical
//      P_BsmBI_Fwd reported 48.9 C.
//
//   3. Do primers the file says are identical come out identical?
//      Three places state that the Esp3I pair is sequence-identical to the BsmBI pair
//      and that P_OS_Fwd is identical to P_Gibson_Fwd. Two of those three were false.
//
//   4. Does every route stop where the vector's own 3' end begins?
//      The gBlock appended a Pol III terminator unconditionally, so on the three
//      acceptors that supply linker + tevopreQ1 + terminator themselves the
//      synthesised fragment would have terminated transcription before the
//      backbone's pseudoknot.
//
//   5. Does the annealing temperature the card prints follow the rule the card states?
//      Not "does it vary" — it correctly does not. Every annealing region in the
//      overlap-extension scheme lies inside the invariant 76 nt scaffold (P1 at nt 1-20,
//      P2 at the last 20, P3 at the last 15), so a constant annealing temperature is the
//      right answer and my first reading of this was wrong. The defect was that a 58 C
//      floor overrode the stated rule on every design and printed a temperature 9 C ABOVE
//      the Tm of the primer that has to anneal, while the comment above it said the floor
//      was 60 and the card said Step 2 followed P3's Tm when P1 is always the lower.
//
// Run:  node analysis/check_module3_primers.js

const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.PPE_HTML = path.join(ROOT, 'plant_prime_editor_v1.0.html');
const { ctx, q } = require(path.join(ROOT, 'tests', 'probe.js'));

const src = fs.readFileSync(path.join(ROOT, "plant_prime_editor_v1.0.html"), "utf8");

const rc = s => s.split('').reverse()
  .map(c => ({ A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' }[c] || c)).join('');

const SPACER = 'GAAAACACTAAAGAGCCACT';
const RT     = 'TCTAGTGTTCCGAGATCGCCCAGC';
const PBS    = 'GGCTCTTTAG';
const NICK   = 'TTGCAGTCCATGGATCCTAA';

const SCAF  = q('M3_SCAFFOLD');
const POLYT = q('POLY_T_TERM');
const VECS  = JSON.parse(q(`JSON.stringify(VECTORS.map(function(v){
  return { id:v.id, enzyme:v.enzyme, oh3:v.overhang_3, pe:v.peSystems||null,
           s3:!!v.supplies_3prime, armsV:!!(v.arms_verified_v && v.gibson_5arm_v),
           arm5:v.gibson_5arm_v||null }; }))`));

// capture the rendered card so the annealing temperatures can be read off it
const pane = ctx.document.createElement('div');
const gbi  = ctx.document.getElementById;
ctx.document.getElementById = id => (id === 'primer-result-pane' ? pane : gbi(id));

function run(vecId, pe, strategy) {
  pane.innerHTML = '';
  vm.runInContext(`
    selectedVec = VECTORS.find(function(v){ return v.id === ${JSON.stringify(vecId)}; });
    m2Data = { peSystem: ${JSON.stringify(pe)},
      spacer:{spacer:${JSON.stringify(SPACER)}}, rt:{seq:${JSON.stringify(RT)}}, pbs:{seq:${JSON.stringify(PBS)}},
      selectedNick:{spacer:${JSON.stringify(NICK)},strand:'+'},
      nickSgRNAs:[{spacer:${JSON.stringify(NICK)},strand:'+'}],
      twinSpacer:{spacer:${JSON.stringify(NICK)},strand:'-'} };
    window._m3EditableSeqs = null; allPrimers.length = 0;
    selectedCloningStrategy = ${JSON.stringify(strategy || 'gg')};
    try { runPrimerDesign(); } catch (e) { globalThis.__err = e.message; }
  `, ctx);
  const err = q('typeof __err !== "undefined" ? __err : ""');
  vm.runInContext('delete globalThis.__err;', ctx);
  const primers = JSON.parse(q(`JSON.stringify(allPrimers.map(function(p){
    return { n:p.name, s:(p.seq||'').toUpperCase(), a:(p.anneal||'').toUpperCase(),
             tm:p.tm, phos:!!p.needsPhospho }; }))`));
  return { err, primers, html: String(pane.innerHTML || '') };
}

let P = 0, F = 0;
const ck = (name, cond, detail) => { cond ? P++ : F++;
  console.log((cond ? '  PASS  ' : '* FAIL *') + ' ' + String(name).padEnd(54) + (detail || '')); };

console.log('vectors: ' + VECS.length + '   (' + VECS.filter(v => v.s3).length +
            ' supply their own 3′ end, ' + VECS.filter(v => v.armsV).length +
            ' have a deposited sequence)\n');

// Primers whose 3' end anneals to the step-1 amplicon (spacer + scaffold). The two
// assembly-arm primers are excluded deliberately: P_Gibson_Rev and P_InFusion_Rev
// anneal through a 6 nt arm on the ASSEMBLED insert and join by exonuclease homology,
// which is documented at FIX SHORT-ANNEAL and is not a defect.
const MUST_PRIME = ['P3_RT_PBS_Rev', 'P_BsmBI_Rev', 'P_Esp3I_Rev', 'P_OS_Rev', 'P_OS_Rev_Arm'];

// Sequences the file claims are identical.
const IDENTICAL = [['P_BsmBI_Fwd', 'P_Esp3I_Fwd'], ['P_BsmBI_Rev', 'P_Esp3I_Rev'],
                   ['P_Gibson_Fwd', 'P_OS_Fwd']];

let primeFail = [], annealFail = [], identFail = [], polyTFail = [], armFail = [], phosFail = [];
const taSeen = new Set(), taFail = [];

for (const v of VECS) {
  const pes = (v.pe && v.pe.length) ? v.pe : ['PE2'];
  const pe  = pes.find(p => ['PE2max', 'ePPE', 'PPE', 'ePPE3'].includes(p)) || pes[0];
  const { err, primers, html } = run(v.id, pe, 'gg');
  if (err) { console.log('* FAIL * ' + v.id + ': runPrimerDesign threw -> ' + err); F++; continue; }
  const get = n => primers.find(p => p.n === n) || null;

  const amp = (SPACER + SCAF).toUpperCase();          // the step-1 product core
  for (const name of MUST_PRIME) {
    const p = get(name); if (!p) continue;
    const tail = p.s.slice(-15);
    if (amp.indexOf(rc(tail)) < 0) primeFail.push(v.id + '/' + name + ' 3′=' + tail);
  }

  // the declared annealing region must be the primer's own 3' terminus
  for (const p of primers) {
    if (!p.a || p.n === 'gBlock_Insert_Sequence') continue;
    if (!p.s.endsWith(p.a)) annealFail.push(v.id + '/' + p.n);
  }

  for (const [x, y] of IDENTICAL) {
    const a = get(x), b = get(y);
    if (a && b && a.s !== b.s) identFail.push(v.id + '/' + x + '≠' + y);
  }

  // the gBlock must stop where the vector's own 3' end begins
  const gb = get('gBlock_Insert_Sequence');
  if (gb) {
    const junction = POLYT + rc(v.oh3 || 'AAAC');
    const hasOwnTerm = gb.s.indexOf(junction) >= 0;
    if (v.s3 && hasOwnTerm) polyTFail.push(v.id + ' (supplies_3prime, gBlock still ends polyT)');
    if (!v.s3 && !hasOwnTerm) polyTFail.push(v.id + ' (needs a terminator, gBlock has none)');
  }

  // the arms every homology route uses must be the deposited ones where they exist
  if (v.armsV) {
    for (const name of ['P_OS_Fwd', 'P_Gibson_Fwd']) {
      const p = get(name);
      if (p && p.s.indexOf(v.arm5) !== 0) armFail.push(v.id + '/' + name);
    }
  }

  // Only the two annealing oligos may be flagged for a 5'-phosphate. P7 and the nick
  // oligos only exist on a PE3 design, so that architecture is run as well — otherwise
  // this assertion passes by never meeting the primer it is about.
  const pe3 = (pes.includes('PE3') || pes.includes('PE3b')) ? run(v.id, 'PE3', 'gg') : null;
  for (const p of primers.concat(pe3 && !pe3.err ? pe3.primers : [])) {
    if (p.phos && !/Nick_(Top|Bot)$/.test(p.n)) phosFail.push(v.id + '/' + p.n);
  }
  if (pe3 && !pe3.err) {
    for (const p of pe3.primers) {
      if (!p.a || p.n === 'gBlock_Insert_Sequence') continue;
      if (!p.s.endsWith(p.a)) annealFail.push(v.id + ' (PE3)/' + p.n);
    }
  }

  // The two annealing temperatures as rendered on the card must be the temperature the
  // card's own rule gives — Tm of the lower-Tm primer + 3 C, NEB's rule for Q5 — and in
  // particular must not sit above the Tm of the primer that has to anneal.
  const tas = [...html.matchAll(/>Annealing<\/td>[\s\S]{0,180}?>(\d+)°C × \d+ s</g)]
    .map(m => Number(m[1]));
  const tmOf = n => { const p = get(n); return p ? p.tm : null; };
  const t1 = tmOf('P1_SpacerFwd'), t2 = tmOf('P2_ScaffoldRev'), t3 = tmOf('P3_RT_PBS_Rev');
  const want = [Math.min(72, Math.round(Math.min(t1, t2) + 3)),
                Math.min(72, Math.round(Math.min(t1, t3) + 3))];
  tas.forEach(t => taSeen.add(t));
  for (let i = 0; i < Math.min(tas.length, 2); i++) {
    if (tas[i] !== want[i]) taFail.push(v.id + ' step' + (i + 1) + ': card ' + tas[i] + ', rule ' + want[i]);
    const lower = i === 0 ? Math.min(t1, t2) : Math.min(t1, t3);
    if (tas[i] > lower + 5) taFail.push(v.id + ' step' + (i + 1) + ': ' + tas[i] +
      '°C is more than 5°C above the lower annealing Tm ' + lower + '°C');
  }
}

console.log('');
ck('every mega-primer’s 3′ end anneals to its template', primeFail.length === 0,
   primeFail.slice(0, 4).join('; '));
ck('every declared annealing region is the 3′ terminus', annealFail.length === 0,
   annealFail.slice(0, 5).join('; '));
ck('primers the file calls identical are identical', identFail.length === 0,
   identFail.slice(0, 4).join('; '));
ck('the gBlock ends where the vector’s 3′ end begins', polyTFail.length === 0,
   polyTFail.slice(0, 4).join('; '));
ck('every homology route reads the deposited arm', armFail.length === 0,
   armFail.slice(0, 4).join('; '));
ck('only annealing oligos are sold a 5′-phosphate', phosFail.length === 0,
   phosFail.slice(0, 4).join('; '));

// ── the pegRNA-2 cassette, on a PPE vector ─────────────────────────────────
console.log('');
const ppe = VECS.find(v => (v.pe || []).some(x => x === 'PPE' || x === 'ePPE3'));
if (!ppe) { ck('a PPE vector exists to test the second cassette', false, ''); }
else {
  const { primers } = run(ppe.id, 'PPE', 'gg');
  const get = n => primers.find(p => p.n.indexOf(n) === 0) || null;
  const p9 = get('P9'), p10 = get('P10'), p11 = get('P11'), p1 = get('P1_'), p2 = get('P2_');
  ck('P9 ends with the same annealing block as P1',
     !!(p9 && p1) && p9.s.slice(-20) === p1.s.slice(-20), p9 ? p9.s.slice(-20) : '');
  ck('P10 is the same primer as P2',
     !!(p10 && p2) && p10.s === p2.s, p10 ? p10.s : '');
  ck('P11′s 3′ end is the scaffold overlap, as P3′s is',
     !!p11 && p11.s.slice(-15) === rc(SCAF.slice(-15)), p11 ? p11.s.slice(-15) : '');
  // the product's 3' extension must read scaffold -> RT2 -> PBS2 -> linker -> tevo -> polyT
  if (p11) {
    const top = rc(p11.s);
    const LINK = q('m3_linker'), TEVO = q('TEVO_preQ1');
    const iScaf = top.indexOf(rc(SCAF.slice(-15))) >= 0 ? 0 : -1;  // scaffold block leads
    const iLink = top.indexOf(LINK), iTevo = top.indexOf(TEVO), iT = top.lastIndexOf(POLYT);
    ck('the pegRNA-2 extension is in cassette order',
       top.startsWith(SCAF.slice(-15)) && iLink > 0 && iTevo > iLink && iT > iTevo,
       'scaf@0 linker@' + iLink + ' tevo@' + iTevo + ' polyT@' + iT + (iScaf < 0 ? '' : ''));
  }
}

// ── twinPE's second cassette, held to the same assertions as PPE's ────────
//
// The PPE block above was written first and the twinPE path carried every one of the same
// faults: PT1 built its tail inline with a BbsI-or-BsaI branch, so a BsmBI vector got a BsaI
// site on PT1 and its own on PT3 — one site of each, insert uncuttable; PT1's 3' end was the
// spacer; PT2 was m3_rc(scaffold.slice(0,20)), facing away; and PT3's m3_rc argument began with
// the terminator. A checker that tests one of two identical-by-design paths is half a checker.
console.log('');
const twinVec = VECS.filter(v => (v.pe || []).includes('twinPE'));
if (!twinVec.length) { ck('a twinPE vector exists to test the second cassette', false, ''); }
else {
  const TW_SP = 'TTGCAGTCCATGGATCCTAA', TW_PBS = 'CATGGACTGC', TW_RT = 'ACCTATCCTCCAATTGTA';
  let tFail = [], enzFail = [];
  for (const v of twinVec) {
    vm.runInContext(`
      selectedVec = VECTORS.find(function(x){ return x.id === ${JSON.stringify(v.id)}; });
      m2Data = { peSystem:'twinPE',
        spacer:{spacer:${JSON.stringify(SPACER)}}, rt:{seq:${JSON.stringify(RT)}}, pbs:{seq:${JSON.stringify(PBS)}},
        twinSpacer:{spacer:${JSON.stringify(TW_SP)},twinNickDist:40},
        twinPBS:[{seq:${JSON.stringify(TW_PBS)}}], twinRT:[{seq:${JSON.stringify(TW_RT)}}] };
      window._m3EditableSeqs = null; allPrimers.length = 0; selectedCloningStrategy = 'gg';
      try { runPrimerDesign(); } catch (e) { globalThis.__err = e.message; }
    `, ctx);
    vm.runInContext('delete globalThis.__err;', ctx);
    const pt = JSON.parse(q(`JSON.stringify(allPrimers.filter(function(p){return /^PT/.test(p.name);})
      .map(function(p){ return { n:p.name, s:(p.seq||'').toUpperCase(), a:(p.anneal||'').toUpperCase() }; }))`));
    const g = n => pt.find(p => p.n.indexOf(n) === 0) || null;
    const pt1 = g('PT1'), pt2 = g('PT2'), pt3 = g('PT3');
    if (!pt1 || !pt3) { tFail.push(v.id + ': no PT1/PT3'); continue; }
    const amp = ('G' + TW_SP + SCAF).toUpperCase();
    // PT1 must end with the scaffold annealing block, as P1 and P9 do
    if (pt1.s.slice(-20) !== SCAF.slice(0, 20)) tFail.push(v.id + '/PT1 3′=' + pt1.s.slice(-20));
    // PT2 must face the cassette
    if (pt2 && pt2.s !== rc(SCAF.slice(-20))) tFail.push(v.id + '/PT2=' + pt2.s);
    // PT3 must be able to prime
    if (amp.indexOf(rc(pt3.s.slice(-15))) < 0) tFail.push(v.id + '/PT3 3′=' + pt3.s.slice(-15));
    // PT1 and PT3 must carry the SAME enzyme's recognition sequence — the vector's
    const recog = { BsaI: 'GGTCTC', BsmBI: 'CGTCTC', Esp3I: 'CGTCTC', BbsI: 'GAAGAC' }[v.enzyme];
    const other = ['GGTCTC', 'CGTCTC', 'GAAGAC'].filter(x => x !== recog);
    for (const [nm, p] of [['PT1', pt1], ['PT3', pt3]]) {
      if (recog && p.s.indexOf(recog) < 0) enzFail.push(v.id + '/' + nm + ' lacks ' + recog);
      for (const o of other) if (p.s.indexOf(o) >= 0) enzFail.push(v.id + '/' + nm + ' carries ' + o);
    }
    // and PT3 must respect the 3' end the vector supplies
    if (v.s3 && pt3.s.indexOf(rc(POLYT)) === (pt3.s.length - POLYT.length)) {
      tFail.push(v.id + '/PT3 appends a terminator on a supplies_3prime acceptor');
    }
  }
  ck('every twinPE cassette-2 primer is built like its pegRNA-1 twin', tFail.length === 0,
     tFail.slice(0, 4).join('; ') || twinVec.length + ' twinPE vectors');
  ck('PT1 and PT3 carry the same enzyme, the vector’s own', enzFail.length === 0,
     enzFail.slice(0, 4).join('; '));
}

// ── the Golden Gate clamp setting must change nothing at its default ──────
//
// 4 bp is what the published plant protocols use and what every number in the paper was
// measured with, so the setting exists to offer NEB's 6 bp without moving the default. That
// is only true if it is asserted.
console.log('');
function renderAll(clamp) {
  vm.runInContext('M3_GG_CLAMP = ' + clamp + ';', ctx);
  const out = {};
  for (const v of VECS) {
    const { err, primers } = run(v.id, ((v.pe && v.pe[0]) || 'PE2'), 'gg');
    if (err) continue;
    out[v.id] = primers.map(p => p.n + '=' + p.s).join('|');
  }
  return out;
}
const at4 = renderAll(4), at6 = renderAll(6);
vm.runInContext('M3_GG_CLAMP = 4;', ctx);
const moved = Object.keys(at4).filter(k => at4[k] !== at6[k]);
ck('the 6 bp setting actually changes the primers', moved.length > 0,
   moved.length + ' of ' + Object.keys(at4).length + ' vectors move');
// The default must still spell the clamps this paper's primers were measured with: CACC on the
// forward tail and TTTT on the reverse. Pinned here rather than against an old build, so the
// assertion survives in the deposit.
const RECOG = { BsaI: 'GGTCTC', BsmBI: 'CGTCTC', Esp3I: 'CGTCTC', BbsI: 'GAAGAC' };
let clampFail = [];
for (const v of VECS) {
  const entries = (at4[v.id] || '').split('|');
  const byName = {};
  entries.forEach(e => { const i = e.indexOf('='); byName[e.slice(0, i)] = e.slice(i + 1); });
  const r = RECOG[v.enzyme] || 'GGTCTC';
  if (byName.P1_SpacerFwd && byName.P1_SpacerFwd.indexOf('CACC' + r) !== 0)
    clampFail.push(v.id + '/P1 starts ' + (byName.P1_SpacerFwd || '').slice(0, 12));
  if (byName.P3_RT_PBS_Rev && byName.P3_RT_PBS_Rev.indexOf('TTTT' + r) !== 0)
    clampFail.push(v.id + '/P3 starts ' + (byName.P3_RT_PBS_Rev || '').slice(0, 12));
}
ck('at the default the clamps are still CACC and TTTT', clampFail.length === 0,
   clampFail.slice(0, 3).join('; ') || 'all ' + VECS.length + ' vectors');
// and the longer clamp must not introduce a second recognition site
let siteFail = [];
for (const k of Object.keys(at6)) {
  for (const entry of at6[k].split('|')) {
    const seq = entry.split('=')[1] || '';
    for (const site of ['GGTCTC', 'CGTCTC', 'GAAGAC']) {
      const n = (seq.match(new RegExp(site, 'g')) || []).length;
      if (n > 1) siteFail.push(k + '/' + entry.split('=')[0] + ' has ' + n + ' x ' + site);
    }
  }
}
ck('the 6 bp clamp creates no extra recognition site', siteFail.length === 0,
   siteFail.slice(0, 3).join('; '));

// ── PPE's PBS2 must prime on the flap pegRNA-1 makes ──────────────────────
//
// The file states in six places that PBS2 = RC(RT1 proximal 13 nt). Until 27 September 2026
// the code took rt.slice(0, 13) -- the DISTAL end -- at six separate call sites, none of which
// referred to the others. `rt` runs 5'->3' as the template and the pegRNA reads scaffold ->
// RT template -> PBS with the PBS meeting the nick exactly, so the nick-proximal end of rt is
// its 3' end. Both halves are asserted: the value, and that one definition serves every path.
console.log('');
const RT1 = 'ACGTTGCAGTCCATGGATCCTAAGGCA';   // 27 nt, so proximal and distal 13 differ
const pbs2 = q('m3_ppePBS2(' + JSON.stringify(RT1) + ')');
ck('PBS2 is RC of the nick-proximal end of RT1', pbs2 === rc(RT1.slice(-13)), pbs2);
ck('PBS2 is NOT RC of the distal end', pbs2 !== rc(RT1.slice(0, 13)),
   'distal would be ' + rc(RT1.slice(0, 13)));
ck('PBS2 is capped at 13 nt', pbs2.length === 13, pbs2.length + ' nt');
ck('a short RT1 yields all of it', q('m3_ppePBS2("ACGTACGT")') === rc('ACGTACGT'), '');
ck('PBS2 is built in exactly one place',
   (src.match(/m3_rc\(\s*rt(Seq)?\.slice\(0,\s*Math\.min/g) || []).length === 0 &&
   (src.match(/m3_ppePBS2\(/g) || []).length >= 7,
   (src.match(/m3_ppePBS2\(/g) || []).length + ' references, 0 inline copies');

// ── the annealing temperatures must move with the design ──────────────────
console.log('');
// A constant here is CORRECT — every annealing region lies inside the invariant scaffold.
// What must hold is that the number follows the stated rule and is not above the Tm of the
// primer that has to anneal. The old 58 C floor broke both on all 15 vectors.
ck('the annealing temperature follows the card’s own rule', taFail.length === 0,
   taFail.length ? taFail.slice(0, 3).join('; ')
                 : [...taSeen].sort((x, y) => x - y).join(', ') + ' °C (fixed by the '
                   + 'scaffold, which is where every annealing region lies)');

// ── the Tm that reaches the user ──────────────────────────────────────────
console.log('');
const nTm = (src.match(/m3_tmDisplay\(/g) || []).length;
ck('one helper formats the Tm both exports print', nTm >= 3,
   nTm + ' occurrences (1 definition + the CSV and text exports)');
// the CSV and the text export are the two places that reach a user's order form
ck('the CSV export goes through the helper',
   /\$\{gc\}%,"\$\{m3_tmDisplay\(p, qc\)\}"/.test(src), '');
ck('the text export goes through the helper',
   /Tm\(anneal\)=\$\{m3_tmDisplay\(p, null\)\}/.test(src), '');
ck('the QC panel does not print a null temperature',
   /qc\.tm === null\s*\n?\s*\? 'not reported/.test(src), '');
const tmShown = String(q(`(function(){
  try {
    var p = { name:'X', seq:'AAAAAAAAAAAAAAAAAAAAAAAAAA', anneal:'AAAAAA', tm:-25.7 };
    return m3_tmDisplay(p, null);
  } catch (e) { return 'THREW: ' + e.message; }
})()`));
ck('a 6 nt arm is not reported as a temperature',
   !/-25\.7/.test(tmShown) && !/THREW|ERR/.test(tmShown), tmShown.slice(0, 46) + '…');

// ── the homopolymer check must be able to fire ────────────────────────────
console.log('');
ck('no stray control byte remains in the source', src.indexOf('\u0001') < 0, '');
const homo = JSON.parse(q(`JSON.stringify(m3_offTargetCheck('GACCAGCTCGGCAAAAAAAA','x'))`));
const clean = JSON.parse(q(`JSON.stringify(m3_offTargetCheck('GACCAGCTCGGCAAGTTCTA','x'))`));
ck('the spacer homopolymer check fires on a run of 8',
   homo.warnings.some(w => /Homopolymer/.test(w)), '');
ck('and stays quiet on a spacer without one',
   !clean.warnings.some(w => /Homopolymer/.test(w)), '');

console.log('\n' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
