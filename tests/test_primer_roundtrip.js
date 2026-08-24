// The only honest test of a cloning primer is whether the product it makes can be cut
// back out. This builds the overlap-extension product from the primers the tool actually
// emits, digests it in silico with the vector's own enzyme, and checks that the fragment
// carrying the spacer comes out with exactly the overhangs the vector expects.
//
// It exists because P3 was wrong in three independent ways at once — the recognition site
// was complemented, the four-base overhang was complemented, and the enzyme was taken from
// the selected strategy rather than the vector. Every one of those produces a primer that
// looks entirely reasonable on screen and fails at the bench. Reading the sequence would
// not have caught them; cutting it does.
const vm = require('vm');
const path = require('path');
const { ctx, q } = require(path.join(__dirname, 'probe.js'));
const rc = s => s.split('').reverse().map(c => ({ A:'T', T:'A', G:'C', C:'G', N:'N' }[c] || c)).join('');
const ENZ = { BsaI:['GGTCTC',1,5], BsmBI:['CGTCTC',1,5], Esp3I:['CGTCTC',1,5], BbsI:['GAAGAC',2,6] };

function digest(top, enz) {
  const [rec, n1, n2] = ENZ[enz]; const cuts = [];
  let m, re = new RegExp(rec, 'g');
  while ((m = re.exec(top))) cuts.push({ top: m.index + rec.length + n1, bot: m.index + rec.length + n2, dir: '+' });
  re = new RegExp(rc(rec), 'g');
  while ((m = re.exec(top))) cuts.push({ top: m.index - n2, bot: m.index - n1, dir: '-' });
  cuts.sort((a, b) => a.top - b.top);
  if (cuts.length < 2) return null;
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    out.push({
      left : top.slice(cuts[i].top, cuts[i].bot),
      body : top.slice(cuts[i].bot, cuts[i + 1].top),
      right: rc(top.slice(cuts[i + 1].top, cuts[i + 1].bot)),
      dirs : cuts[i].dir + cuts[i + 1].dir,
    });
  }
  return out;
}

const SPACER = 'GACCAGCTCGGCAAGTTCTA', RT = 'TTCGATGAGCTCAGCTGACC', PBS = 'CTGGCTGCAT';
const NICK   = 'TTGCAGTCCATGGATCCTAA';

function design(vecId, pe, strategy) {
  vm.runInContext(`
    selectedVec = VECTORS.find(v => v.id === ${JSON.stringify(vecId)});
    m2Data = { peSystem: ${JSON.stringify(pe)},
      spacer:{spacer:${JSON.stringify(SPACER)}}, rt:{seq:${JSON.stringify(RT)}}, pbs:{seq:${JSON.stringify(PBS)}},
      selectedNick:{spacer:${JSON.stringify(NICK)},strand:'+'}, nickSgRNAs:[{spacer:${JSON.stringify(NICK)},strand:'+'}] };
    window._m3EditableSeqs = null; allPrimers.length = 0; selectedCloningStrategy = ${JSON.stringify(strategy || 'gg')};
    try { runPrimerDesign(); } catch (e) { globalThis.__err = e.message; }
  `, ctx);
  const err = q('typeof __err !== "undefined" ? __err : ""');
  vm.runInContext('delete globalThis.__err;', ctx);
  const primers = q('JSON.parse(JSON.stringify(allPrimers.map(p=>({name:p.name,seq:p.seq}))))');
  return { err, primers };
}

const V = q('JSON.parse(JSON.stringify(VECTORS.map(v=>({id:v.id,enzyme:v.enzyme,oh5:v.overhang_5,oh3:v.overhang_3,pe:v.peSystems}))))');
const SCAF = q('M3_SCAFFOLD'), POLYT = q('POLY_T_TERM'), TEVO = q('TEVO_preQ1');
let pass = 0, fail = 0;

function roundTrip(v, pe, strategy, cutEnz, label) {
  const { err, primers } = design(v.id, pe, strategy);
  if (err) { console.log('* FAIL * ' + label + ': runPrimerDesign threw -> ' + err); fail++; return; }
  const get = n => { const p = primers.find(x => (x.name || '').indexOf(n) === 0); return p ? p.seq.toUpperCase().replace(/[^ACGTN]/g, '') : null; };
  const p1 = get('P1'), p3 = get('P3');
  if (!p1 || !p3) { console.log('* FAIL * ' + label + ': no P1/P3'); fail++; return; }

  // Backbones that already carry tevopreQ1 and the terminator take an insert that stops at
  // the PBS, so the product is reconstructed without them for those vectors.
  const vec3p  = q('(VECTORS.find(x=>x.id===' + JSON.stringify(v.id) + ')||{}).supplies_3prime') === true;
  const isTevo = !vec3p && ['PE2max','ePPE','PPE','ePPE3'].indexOf(pe) >= 0;
  const linker = q('m3_linker') || 'GCAAAAAAA';
  const spacerFP = (SPACER[0] === 'G' ? '' : 'G') + SPACER;
  const tailMark = vec3p ? PBS : POLYT;
  const core = spacerFP + SCAF + RT + PBS + (isTevo ? linker + TEVO : '') + (vec3p ? '' : POLYT);
  const p1Tail = p1.slice(0, Math.max(0, p1.indexOf(spacerFP)));
  const p3top  = rc(p3);
  const k      = p3top.lastIndexOf(tailMark);
  const product = p1Tail + core + (k >= 0 ? p3top.slice(k + tailMark.length) : '');
  if (vec3p && /T{6,}/.test(p3top.slice(0, 40).replace(/^T{4}/, '')))
    { console.log('* FAIL * ' + label + ': insert still carries a polyT terminator the vector supplies'); fail++; return; }

  const frags = digest(product, cutEnz.replace('Esp3I', 'BsmBI'));
  if (!frags) { console.log('* FAIL * ' + label + ': product has no usable ' + cutEnz + ' pair'); fail++; return; }
  const ins = frags.find(f => f.body.indexOf(SPACER) >= 0);
  if (!ins) { console.log('* FAIL * ' + label + ': spacer-bearing fragment not released'); fail++; return; }

  const problems = [];
  if (ins.left  !== v.oh5) problems.push('left ' + ins.left + ' != overhang_5 ' + v.oh5);
  if (ins.right !== v.oh3) problems.push('right ' + ins.right + ' != overhang_3 ' + v.oh3);
  if (ins.dirs !== '+-')   problems.push('sites face ' + ins.dirs + ', must be +- to cut inward');
  if (problems.length) { console.log('* FAIL * ' + label + ': ' + problems.join('; ')); fail++; }
  else { pass++; }
}

// 1. every vector on its own enzyme, default Golden Gate
V.forEach(v => {
  const pe = v.pe.indexOf('PE2') >= 0 ? 'PE2' : v.pe[0];
  roundTrip(v, pe, 'gg', v.enzyme, v.id);
});

// 2. the BsmBI and Esp3I rescue routes. These exist for inserts that carry an internal site
//    for the vector's own enzyme: the product is cut with the substitute, which leaves the
//    same overhangs. If only one primer picked up the substitute the product would be
//    uncuttable, which is exactly what used to happen.
['bsmbi', 'esp3i'].forEach(strat => {
  V.filter(v => v.enzyme === 'BsaI').slice(0, 3).forEach(v => {
    roundTrip(v, 'PE2', strat, 'BsmBI', v.id + ' under the ' + strat + ' rescue');
  });
});

// 3. a PE3 vector, where a second cassette and its own primers are generated alongside
V.filter(v => (v.pe || []).indexOf('PE3') >= 0).slice(0, 4).forEach(v => {
  roundTrip(v, 'PE3', 'gg', v.enzyme, v.id + ' as PE3');
});

// 4. a tevopreQ1 system, where the insert gains a linker and 37 nt of motif
V.filter(v => (v.pe || []).indexOf('PE2max') >= 0).slice(0, 3).forEach(v => {
  roundTrip(v, 'PE2max', 'gg', v.enzyme, v.id + ' as PE2max');
});

console.log(pass + ' passed, ' + fail + ' failed');
console.log('every vector releases its insert with the overhangs it declares');
if (fail) process.exit(1);
