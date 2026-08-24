// The internal restriction-site screen decides whether Golden Gate is offered at all.
// If it misses a site, the tool cheerfully recommends a route that cuts the insert in half.
// Each case below plants a known site in the RT template and asserts what the screen returns.
const vm = require('vm'), path = require('path');
const { ctx, q } = require(path.join(__dirname, 'probe.js'));
let pass = 0, fail = 0;
const chk = (label, got, want) => {
  const ok = String(got) === String(want);
  ok ? pass++ : fail++;
  console.log((ok ? '  PASS  ' : '* FAIL * ') + label.padEnd(62) + ' got ' + got + (ok ? '' : '   want ' + want));
};

function screen(vecId, strategy, rt) {
  return vm.runInContext(`(function(){
    selectedVec = VECTORS.find(v => v.id === ${JSON.stringify(vecId)});
    selectedCloningStrategy = ${JSON.stringify(strategy)};
    var ins = 'GACCAGCTCGGCAAGTTCTA' + M3_SCAFFOLD + ${JSON.stringify(rt)} + 'CTGGCTGCAT';
    var hits = m3_checkInternalRE(ins, selectedVec);
    return JSON.stringify(hits.filter(function(h){return h.critical;})
                              .map(function(h){return h.name + '@' + h.pos + h.strand;}));
  })()`, ctx);
}
const CLEAN = 'TTCGATGAGCTCAGCTGACC';
const has = (s, enz) => JSON.parse(s).some(x => x.indexOf(enz) === 0);
const n   = s => JSON.parse(s).length;

console.log('\n=== internal restriction-site screening ===');
chk('clean insert, BsaI vector: no critical hit',      n(screen('pEPPE-dicot','gg',CLEAN)), 0);
chk('BsaI site planted, BsaI vector: caught',          has(screen('pEPPE-dicot','gg','TTCGGTCTCGAGCTCAGCTGACC'),'BsaI'), true);
// the reverse strand of GGTCTC is GAGACC — a site on either strand cuts
chk('BsaI site on the reverse strand: caught',         has(screen('pEPPE-dicot','gg','TTCGAGACCGAGCTCAGCTGACC'),'BsaI'), true);
chk('BbsI site, BbsI vector: caught',                  has(screen('pVu2024-dicot','gg','TTCGAAGACGAGCTCAGCTGACC'),'BbsI'), true);
// pYPQ141D-peg is opened with BsmBI AND BsaI; both must be screened
chk('second acceptor enzyme (BsaI) on a BsmBI vector', has(screen('pYPQ166-OsPE2','gg','TTCGGTCTCGAGCTCAGCTGACC'),'BsaI'), true);
chk('primary enzyme (BsmBI) on that vector',           has(screen('pYPQ166-OsPE2','gg','TTCCGTCTCGAGCTCAGCTGACC'),'BsmBI'), true);
// choosing the BsmBI rescue must screen BsmBI, not just the vector's BsaI
chk('BsmBI rescue selected: BsmBI site now critical',  has(screen('pEPPE-dicot','bsmbi','TTCCGTCTCGAGCTCAGCTGACC'),'BsmBI'), true);
chk('clean insert under the BsmBI rescue: still clean', n(screen('pEPPE-dicot','bsmbi',CLEAN)), 0);
// a palindromic backbone site must not be double counted
chk('EcoRI reported once, not twice',
    (function(){ const all = vm.runInContext(`(function(){
      selectedVec = VECTORS.find(v=>v.id==='pEPPE-dicot');
      var ins='GACCAGCTCGGCAAGTTCTA'+M3_SCAFFOLD+'TTCGAATTCGAGCTCAGCTGACC'+'CTGGCTGCAT';
      return JSON.stringify(m3_checkInternalRE(ins,selectedVec).filter(function(h){return h.name==='EcoRI';}));
    })()`, ctx); return JSON.parse(all).length; })(), 1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
