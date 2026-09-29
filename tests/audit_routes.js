// ─────────────────────────────────────────────────────────────────────────────
//  What each cloning route actually emits, and what the vector overhangs are.
//
//  Supplementary Table S7 described the six assembly routes, and four of its six
//  rows were wrong about which primers the route produces. The BsmBI and Esp3I
//  rows claimed P1-P6 when both filters explicitly drop P1 and add their own
//  enzyme pair; the one-step Gibson row claimed P1-P4 when the route emits the
//  P_OS trio plus P2 and the verification pair; the gBlock row claimed the
//  verification primers alone when it also emits the synthesised insert and three
//  Gibson primers. Table S7 also stated a single overhang pair, ACCG/AAAC, as if
//  it were "the" BsaI overhang — it belongs to 3 of the 11 BsaI vectors — and a
//  nick-cassette pair, ACCG/CGTG, that no vector in the deposit has.
//
//  None of that was checked by anything. This test pins both halves against the
//  shipped engine, so a route filter cannot change without the table noticing.
// ─────────────────────────────────────────────────────────────────────────────
// The rice ALS labels are namespaced by source study (analysis/als_sites.json): two
// different protospacers in one gene were both called OsALS-T2, one by Lin 2020 and one
// by Lin 2021. This test uses the worked-example site, Lin 2021's.
const {ctx} = require('./probe.js'); const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let P = 0, F = 0;
const ck = (n,c,d) => { c?P++:F++; console.log((c?'  PASS  ':'* FAIL *') + ' ' + n.padEnd(56) + (d||'')); };

/* ── the routes, as the interface filters them ───────────────────────────── */
function parseCSV(l){ const o=[]; let c='', q=false;
  for (const ch of l) { if (ch==='"') q=!q; else if (ch===','&&!q) {o.push(c);c='';} else c+=ch; }
  o.push(c); return o; }
const csv  = fs.readFileSync(ROOT+'/data/benchmark_scored.csv','utf8').split('\n').filter(Boolean);
const HEAD = parseCSV(csv[0]), col = n => HEAD.indexOf(n);
const f = csv.slice(1).map(parseCSV).find(x => x[col('locus')]==='OsALS-T2 (Lin 2021)' && x[col('edit_type')]==='SNP');

const from = f[col('edit_from_top')] || f[col('edit_from')];
const to   = f[col('edit_to_top')]   || f[col('edit_to')];
ctx.__a = { g:f[col('genomic_seq')], nk:+f[col('nick_pos')], st:f[col('spacer_strand')],
            sp:f[col('published_spacer')],
            ed:[{genomicPos:+f[col('edit_pos')]-1, type:'SNP', ref:from, alt:to}] };

const routes = JSON.parse(vm.runInContext(`(function(){
  selectedVec = VECTORS.find(function(v){ return v.id === 'ePE2-rice'; });
  selectedCloningStrategy = 'gg';
  var pbs = genPBS(__a.g, __a.nk, __a.st, 8, 15, __a.sp, false);
  var rt  = genRT(__a.g, __a.nk, __a.ed, __a.st, 10, 30, __a.sp, pbs[0].seq);
  m2Data = { peSystem:'PE2', spacer:{spacer:__a.sp}, rt:{seq:rt[0].seq}, pbs:{seq:pbs[0].seq},
             selectedNick:null, nickSgRNAs:[null], twinSpacer:null,
             twinPBS:[{seq:pbs[0].seq}], twinRT:[{seq:rt[0].seq}], locus:'OsALS-T2 (Lin 2021)' };
  window._m3EditableSeqs = null; allPrimers.length = 0; runPrimerDesign();
  var F = {
    gg:    function(p){ return !p.isGibsonPrimer&&!p.isInFusionPrimer&&!p.isOneStepPrimer&&!p.isBbsINote&&!p.isGBlockPrimer&&['P_BsmBI_Fwd','P_BsmBI_Rev','P_Esp3I_Fwd','P_Esp3I_Rev'].indexOf(p.name)<0; },
    bsmbi: function(p){ return !p.isGibsonPrimer&&!p.isInFusionPrimer&&!p.isOneStepPrimer&&!p.isBbsINote&&!p.isGBlockPrimer&&['P1_SpacerFwd','P_Esp3I_Fwd','P_Esp3I_Rev'].indexOf(p.name)<0; },
    esp3i: function(p){ return !p.isGibsonPrimer&&!p.isInFusionPrimer&&!p.isOneStepPrimer&&!p.isBbsINote&&!p.isGBlockPrimer&&['P1_SpacerFwd','P_BsmBI_Fwd','P_BsmBI_Rev'].indexOf(p.name)<0; },
    onestep_gibson: function(p){ return (p.isOneStepPrimer||p.isUniversal||['P5_Verify_Fwd','P6_Verify_Rev','P_OS_Fwd','P_OS_Rev','P_OS_Rev_Arm','P2_ScaffoldRev','P7_NickSgRNA_PCR_Fwd','P_Nick_Bot'].indexOf(p.name)>=0||(p.role&&(p.role.indexOf('PPE')>=0||p.role.indexOf('twinPE')>=0))); },
    gblock:function(p){ return p.isGibsonPrimer||p.isGBlockPrimer||['P5_Verify_Fwd','P6_Verify_Rev'].indexOf(p.name)>=0; },
    infusion:function(p){ return (p.isInFusionPrimer||p.isUniversal||['P2_ScaffoldRev','P3_RT_PBS_Rev','P5_Verify_Fwd','P6_Verify_Rev','P_InFusion_Fwd','P_InFusion_Rev','P7_NickSgRNA_PCR_Fwd','P_Nick_Bot'].indexOf(p.name)>=0); }
  };
  var r = {};
  Object.keys(F).forEach(function(k){ r[k] = allPrimers.filter(F[k]).map(function(x){ return x.name; }); });
  return JSON.stringify(r);
})()`, ctx, {timeout:30000}));

const has = (k, n) => routes[k].indexOf(n) >= 0;
console.log('\n--- what each route emits ---');
Object.keys(routes).forEach(k => console.log('  ' + k.padEnd(16) + routes[k].length + '  ' + routes[k].join(', ')));

ck('Golden Gate emits P1 through P6',
   ['P1_SpacerFwd','P2_ScaffoldRev','P3_RT_PBS_Rev','P4_RT_PBS_Fwd_overlap','P5_Verify_Fwd','P6_Verify_Rev']
     .every(n => has('gg', n)) && routes.gg.length === 6, routes.gg.length + ' primers');

// the claim Table S7 got wrong: the enzyme-swap routes DROP P1 and add their own pair
ck('BsmBI drops P1 and adds its own pair',
   !has('bsmbi','P1_SpacerFwd') && has('bsmbi','P_BsmBI_Fwd') && has('bsmbi','P_BsmBI_Rev'));
ck('Esp3I drops P1 and adds its own pair',
   !has('esp3i','P1_SpacerFwd') && has('esp3i','P_Esp3I_Fwd') && has('esp3i','P_Esp3I_Rev'));
ck('one-step Gibson emits the P_OS trio, not P1–P4',
   has('onestep_gibson','P_OS_Fwd') && has('onestep_gibson','P_OS_Rev') && has('onestep_gibson','P_OS_Rev_Arm')
   && !has('onestep_gibson','P1_SpacerFwd') && !has('onestep_gibson','P3_RT_PBS_Rev'));
ck('gBlock emits the synthesised insert and Gibson primers, not P5/P6 alone',
   has('gblock','gBlock_Insert_Sequence') && has('gblock','P_Gibson_Fwd') && routes.gblock.length > 2);
ck('In-Fusion emits its own pair plus P2 and P3',
   has('infusion','P_InFusion_Fwd') && has('infusion','P2_ScaffoldRev') && has('infusion','P3_RT_PBS_Rev'));
ck('every route emits the P5/P6 verification pair',
   Object.keys(routes).every(k => has(k,'P5_Verify_Fwd') && has(k,'P6_Verify_Rev')));

/* ── the overhangs are per-vector, not per-enzyme ─────────────────────────── */
const V = JSON.parse(vm.runInContext(`JSON.stringify(VECTORS.map(function(v){ return {
  name:v.name, enzyme:v.enzyme, o5:v.overhang_5, o3:v.overhang_3,
  n5:v.nick_overhang_5, n3:v.nick_overhang_3 }; }))`, ctx, {timeout:20000}));

const bsa = V.filter(v => v.enzyme === 'BsaI');
const pairs = {};
bsa.forEach(v => { const k = v.o5+'/'+v.o3; pairs[k] = (pairs[k]||0)+1; });
console.log('\n--- BsaI overhang pairs ---');
Object.entries(pairs).forEach(([k,n]) => console.log('  ' + k.padEnd(12) + n + ' vector(s)'));

ck('BsaI vectors do not share one overhang pair', Object.keys(pairs).length > 1,
   Object.keys(pairs).length + ' distinct pairs across ' + bsa.length + ' BsaI vectors');
ck('ACCG/AAAC is a minority of BsaI vectors', (pairs['ACCG/AAAC']||0) < bsa.length/2,
   (pairs['ACCG/AAAC']||0) + ' of ' + bsa.length);
// the pair Table S7 invented
ck('no vector has a CGTG overhang',
   V.every(v => ![v.o3, v.n3, v.o5, v.n5].includes('CGTG')));
ck('every vector declares both guide overhangs',
   V.every(v => /^[ACGT]{4}$/.test(v.o5||'') && /^[ACGT]{4}$/.test(v.o3||'')));
const dual = V.filter(v => v.n5);
ck('every nick cassette declares both overhangs',
   dual.every(v => /^[ACGT]{4}$/.test(v.n5) && /^[ACGT]{4}$/.test(v.n3)),
   dual.length + ' vectors carry a nick cassette');

console.log(`\n${P} passed, ${F} failed`);
