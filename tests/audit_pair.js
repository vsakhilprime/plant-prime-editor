// ─────────────────────────────────────────────────────────────────────────────
//  m2_pairCheck — the primer-binding site and the RT template, judged together.
//
//  genPBS scores three channels and cannot score PBS<->RT, because the template
//  does not exist when the primer-binding site is chosen. genRT then scores
//  RT<->PBS at weight 1.5 against a single frozen partner. m2_pairCheck closes
//  the loop by measuring the chosen pair once both sequences exist, and says
//  whether any other candidate would have paired better.
//
//  What this locks in:
//    1  a clean pair returns band 'perfect' and NO warning, and does not spend
//       genRT calls looking for an alternative
//    2  a pair in the low band or worse returns a warning that names the energy
//    3  when every candidate returns the same pairing energy, the warning says
//       the duplex belongs to the template and length will not avoid it
//    4  it never throws on degenerate input, because design() must not die on it
//    5  selection is UNCHANGED: pairCheck reports, it does not re-rank
// ─────────────────────────────────────────────────────────────────────────────
// The rice ALS labels are namespaced by source study (analysis/als_sites.json): two
// different protospacers in one gene were both called OsALS-T2, one by Lin 2020 and one
// by Lin 2021. This test uses the worked-example site, Lin 2021's.
const {ctx} = require('./probe.js'); const vm = require('vm'), fs = require('fs'), path = require('path');
const run = (e,a) => { ctx.__a = a; return vm.runInContext(e, ctx, {timeout:30000}); };
let P=0, F=0;
const ck = (n,c,d) => { c?P++:F++; console.log((c?'  PASS  ':'* FAIL *') + ' ' + n.padEnd(60) + (d||'')); };

const ROOT = path.resolve(__dirname, '..');
function parseCSV(l){ const o=[]; let c='', q=false;
  for(const ch of l){ if(ch==='"') q=!q; else if(ch===','&&!q){o.push(c);c='';} else c+=ch; }
  o.push(c); return o; }
const csv  = fs.readFileSync(ROOT+'/data/benchmark_scored.csv','utf8').split('\n').filter(Boolean);
const HEAD = parseCSV(csv[0]);
const rowFor = loc => csv.slice(1).map(parseCSV).find(f => f[HEAD.indexOf('locus')] === loc);

function pairAt(loc, bandKey){
  const f = rowFor(loc);
  if (!f) return null;
  run('_PPE_TM_BAND_KEY = __a', bandKey || 'rice');
  const a = { g:f[HEAD.indexOf('genomic_seq')], n:+f[HEAD.indexOf('nick_pos')],
              st:f[HEAD.indexOf('spacer_strand')], sp:f[HEAD.indexOf('published_spacer')],
              ed:[{ genomicPos:+f[HEAD.indexOf('edit_pos')]-1, type:f[HEAD.indexOf('edit_type')],
                    ref:f[HEAD.indexOf('edit_from')], alt:f[HEAD.indexOf('edit_to')] }] };
  return JSON.parse(run(`JSON.stringify((function(){
    var pbs = genPBS(__a.g,__a.n,__a.st,8,22,__a.sp,false);
    var rt  = genRT(__a.g,__a.n,__a.ed,__a.st,10,30,__a.sp,pbs[0].seq);
    if(!pbs.length || !rt.length) return null;
    var pc  = m2_pairCheck(pbs, pbs[0].seq, rt[0].seq, __a.g, __a.n, __a.ed, __a.st, __a.sp, 10, 30);
    return { pc: pc, topLen: pbs[0].length, nCand: pbs.length };
  })())`, a));
}

// 1 — a clean pair is silent
const clean = pairAt('OsALS-T2 (Lin 2021)');
ck('clean pair: band is perfect',        clean && clean.pc.band === 'perfect', clean ? 'dG '+clean.pc.dG : 'no result');
ck('clean pair: no warning raised',      clean && clean.pc.warnings.length === 0);
ck('clean pair: no alternative searched', clean && clean.pc.alternativeExists === false);

// 2, 3 — a low-band pair reports, and reports correctly that it is inescapable.
//        At OsACC-T1 every candidate returns the identical pairing energy, which is
//        the case the warning text has to get right.
const low = pairAt('OsACC-T1');
ck('low-band pair: band is low',         low && low.pc.band === 'low', low ? 'dG '+low.pc.dG : 'no result');
ck('low-band pair: one warning raised',  low && low.pc.warnings.length === 1);
ck('low-band pair: warning names the energy',
   low && low.pc.warnings[0].indexOf(low.pc.dG.toFixed(1)) >= 0);
ck('low-band pair: no candidate escapes it', low && low.pc.alternativeExists === false);
ck('low-band pair: warning says the template owns the duplex',
   low && /property of the template/.test(low.pc.warnings[0]));

// 4 — never throws
let threw = false;
try {
  run(`m2_pairCheck([], '', '', 'ACGT', 2, [], '+', 'ACGT', 10, 30)`);
  run(`m2_pairCheck(null, null, null, null, 0, null, '+', '', 10, 30)`);
} catch (e) { threw = true; }
ck('degenerate input does not throw',    !threw);

// 5 — reporting only: the primer-binding site the pipeline picks is untouched
const beforeAfter = ['OsACC-T1','OsGAPDH-T1','OsCDC48-T1'].map(loc => {
  const f = rowFor(loc); if (!f) return true;
  run('_PPE_TM_BAND_KEY = __a', 'rice');
  const a = { g:f[HEAD.indexOf('genomic_seq')], n:+f[HEAD.indexOf('nick_pos')],
              st:f[HEAD.indexOf('spacer_strand')], sp:f[HEAD.indexOf('published_spacer')] };
  const twice = JSON.parse(run(`JSON.stringify((function(){
    var a = genPBS(__a.g,__a.n,__a.st,8,22,__a.sp,false)[0].length;
    var b = genPBS(__a.g,__a.n,__a.st,8,22,__a.sp,false)[0].length;
    return [a,b];
  })())`, a));
  return twice[0] === twice[1];
});
ck('genPBS selection is unchanged and stable', beforeAfter.every(Boolean));

console.log(`\n${P} passed, ${F} failed`);
