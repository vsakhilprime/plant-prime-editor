// ─────────────────────────────────────────────────────────────────────────────
//  Randomised end-to-end check of the design engine.
//
//  Every other test in this suite uses either a synthetic sequence chosen to make
//  a particular case reachable, or a benchmark locus. Both are sequences someone
//  picked. This one does not pick: it generates random sequence, puts a random
//  edit of a random class at a random position on a random strand, and asserts
//  the invariants that must hold whatever the input is.
//
//  The invariants, and why each is the right thing to assert:
//
//    1  nothing throws. A design tool that raises on an unlucky sequence is
//       unusable, and an exception inside genRT or genPBS is swallowed in several
//       callers, so a throw becomes a silently missing candidate.
//
//    2  every RT template, read back onto the top strand, is found in the EDITED
//       genome. This is the whole job of the template: it is the sequence the
//       reverse transcriptase writes, so the flap it produces must match the
//       genome as the user asked for it to become. Three separate defects were
//       caught by exactly this check on the benchmark — edits passed on the wrong
//       strand, multi-base substitutions spliced in as insertions, and multi-base
//       deletions truncated to one base — which is why it is now run on random
//       input as well as on the twenty-five published loci.
//
//    3  every primer-binding site is the reverse complement of the bases
//       immediately 5' of the nick on the strand the polymerase extends, read
//       from the REFERENCE. The primer binds the parental strand; taking it from
//       the edited sequence would be a design that cannot prime.
//
//    4  every PE3b candidate obeys the PE3b rule: non-edited strand, an edited
//       base inside the protospacer, no edited base inside the PAM, the spacer
//       read from the edited sequence and the PAM from the reference.
//
//  The generator is seeded, so a failure is reproducible. Change the seed to
//  search elsewhere.
// ─────────────────────────────────────────────────────────────────────────────
const {ctx} = require('./probe.js'); const vm = require('vm');
const run = (e,a) => { ctx.__a = a; return vm.runInContext(e, ctx, {timeout:20000}); };
let P = 0, F = 0;
const ck = (n,c,d) => { c?P++:F++; console.log((c?'  PASS  ':'* FAIL *') + ' ' + n.padEnd(52) + (d||'')); };

const RCB = {A:'T', T:'A', G:'C', C:'G'};
const RC  = s => s.split('').reverse().map(c => RCB[c] || 'N').join('');

function lcg(seed) { return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }

// ── 1-3: the whole design, all four edit classes, both strands ───────────────
{
  const rnd = lcg(20260912), base = () => 'ACGT'[Math.floor(rnd()*4)];
  let built = 0, threw = 0, rtBad = 0, pbsBad = 0, noSpacer = 0;
  const detail = [];

  for (let trial = 0; trial < 300; trial++) {
    let g = ''; for (let i = 0; i < 400; i++) g += base();
    const st = rnd() < 0.5 ? '+' : '-';
    const p  = 180 + Math.floor(rnd()*40);
    const kind = ['SNP','MNP','INS','DEL'][Math.floor(rnd()*4)];
    let edits, edited;

    if (kind === 'SNP') {
      let a = base(); while (a === g[p]) a = base();
      edits = [{genomicPos:p, type:'SNP', ref:g[p], alt:a}];
      edited = g.slice(0,p) + a + g.slice(p+1);
    } else if (kind === 'MNP') {
      const L = 2 + Math.floor(rnd()*2);
      let a = ''; for (let i = 0; i < L; i++) a += base();
      if (a === g.slice(p, p+L)) continue;
      edits = [{genomicPos:p, type:'MNP', ref:g.slice(p,p+L), alt:a, genomicEnd:p+L-1}];
      edited = g.slice(0,p) + a + g.slice(p+L);
    } else if (kind === 'INS') {
      const L = 1 + Math.floor(rnd()*3);
      let a = ''; for (let i = 0; i < L; i++) a += base();
      edits = [{genomicPos:p, genomicEnd:p, type:'INS', ref:'-', alt:a, _isInsertion:true, _insertionLen:L}];
      edited = g.slice(0,p) + a + g.slice(p);
    } else {
      const L = 1 + Math.floor(rnd()*3);
      edits = [];
      for (let i = 0; i < L; i++)
        edits.push({genomicPos:p+i, type:'DEL', ref:g[p+i], alt:'-', _multiDelGroup:p, _multiDelLen:L});
      edited = g.slice(0,p) + g.slice(p+L);
    }

    let r;
    try {
      r = JSON.parse(run(`JSON.stringify((function(){
        var c = findSpacers(__a.g,'NGG',20,__a.p,__a.edits,{strand:__a.st}) || [];
        c = c.filter(function(x){ return x.isCorrectSide !== false; });
        if (!c.length) return {none:1};
        var sp = c[0], nk = sp.nickPosGenomic;
        var pbs = genPBS(__a.g, nk, __a.st, 8, 22, sp.spacer, false);
        var rt  = genRT(__a.g, nk, __a.edits, __a.st, 10, 34, sp.spacer, pbs.length?pbs[0].seq:'');
        return { nk:nk, pbs: pbs.length?pbs[0].seq:null, rt: rt.length?rt[0].seq:null };
      })())`, {g, p, st, edits}));
    } catch (e) {
      threw++; if (detail.length < 4) detail.push('THREW ' + kind + ' ' + st + ': ' + e.message);
      continue;
    }
    if (r.none) { noSpacer++; continue; }
    built++;

    if (r.rt) {
      const top = st === '+' ? RC(r.rt) : r.rt;
      if (edited.indexOf(top) < 0) {
        rtBad++;
        if (detail.length < 4) detail.push('RT ' + kind + ' ' + st + ' nick ' + r.nk + ' ' + r.rt);
      }
    }
    if (r.pbs) {
      const L = r.pbs.length;
      const want = st === '+' ? RC(g.slice(r.nk - L, r.nk)) : g.slice(r.nk + 1, r.nk + 1 + L);
      if (r.pbs !== want) {
        pbsBad++;
        if (detail.length < 4) detail.push('PBS ' + kind + ' ' + st + ' got ' + r.pbs + ' want ' + want);
      }
    }
  }

  console.log(`\n--- ${built} random designs built (${noSpacer} sequences had no usable spacer) ---`);
  ck('the engine never throws',                         threw  === 0, threw  ? detail[0] : '');
  ck('every RT template encodes its edit',              rtBad  === 0, rtBad  ? detail.find(d=>d.startsWith('RT'))  : built + ' checked');
  ck('every primer-binding site anneals at the nick',   pbsBad === 0, pbsBad ? detail.find(d=>d.startsWith('PBS')) : built + ' checked');
  ck('enough designs were built to be worth asserting', built >= 200, built + ' built');
}

// ── 4: the PE3b rule, on random input ────────────────────────────────────────
{
  const rnd = lcg(77771), base = () => 'ACGT'[Math.floor(rnd()*4)];
  let designs = 0, cands = 0;
  const v = {strand:0, proto:0, pam:0, spacer:0, pamRef:0};

  for (let t = 0; t < 300; t++) {
    let g = ''; for (let i = 0; i < 400; i++) g += base();
    const st = rnd() < 0.5 ? '+' : '-';
    const p  = 180 + Math.floor(rnd()*40);
    let a = base(); while (a === g[p]) a = base();
    const edits  = [{genomicPos:p, type:'SNP', ref:g[p], alt:a}];
    const edited = g.slice(0,p) + a + g.slice(p+1);

    let r;
    try {
      r = JSON.parse(run(`JSON.stringify((function(){
        var c = findSpacers(__a.g,'NGG',20,__a.p,__a.edits,{strand:__a.st}) || [];
        c = c.filter(function(x){ return x.isCorrectSide !== false; });
        if (!c.length) return null;
        var nk = c[0].nickPosGenomic;
        return { nk:nk, n: genNickSgRNA(__a.g, nk, __a.st, __a.edits, 'NGG', 20, 'PE3b') };
      })())`, {g, p, st, edits}));
    } catch (e) { v.strand = -1; break; }
    if (!r) continue;
    designs++;
    const want = st === '+' ? '-' : '+';
    for (const c of r.n) {
      cands++;
      const refSeq = c.strand === '+' ? g      : RC(g);
      const edSeq  = c.strand === '+' ? edited : RC(edited);
      const i = c.strand === '+' ? c.genomicPos : (refSeq.length - (c.genomicPos + 3) - 20);
      if (c.strand !== want)                      v.strand++;
      if (!(c.editsInProtospacer >= 1))           v.proto++;
      if (c.pamIntact !== true)                   v.pam++;
      if (c.spacer !== edSeq.slice(i, i + 20))    v.spacer++;
      if (c.pam    !== refSeq.slice(i + 20, i + 23)) v.pamRef++;
    }
  }

  console.log(`\n--- PE3b over ${designs} random designs, ${cands} candidates ---`);
  ck('PE3b: every candidate on the non-edited strand',  v.strand === 0, v.strand + ' wrong');
  ck('PE3b: every candidate carries the edit',          v.proto  === 0, v.proto  + ' without');
  ck('PE3b: every candidate PAM intact',                v.pam    === 0, v.pam    + ' not intact');
  ck('PE3b: every spacer read from the edited sequence',v.spacer === 0, v.spacer + ' wrong');
  ck('PE3b: every PAM read from the reference',         v.pamRef === 0, v.pamRef + ' wrong');
  ck('enough candidates were returned to be worth asserting', cands >= 200, cands + ' candidates');
}

console.log(`\n${P} passed, ${F} failed`);
