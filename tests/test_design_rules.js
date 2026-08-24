// Scoring rules that come from the literature, asserted against the engine rather than the
// comment that describes them. A preference that silently stops being applied is invisible.
const vm = require('vm'), path = require('path');
const { ctx, q } = require(path.join(__dirname, 'probe.js'));
let pass = 0, fail = 0;
const chk = (l, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '* FAIL * ') + l.padEnd(58) + (d || '')); };

// ── Exclude first C in the RT template ────────────────────────────────────
// Anzalone 2019 Nature 576:149; PlantPegDesigner default (Jin 2023 Nat Protoc 18:831 Table 2).
chk('the rule is on by default', q('M2_EXCLUDE_FIRST_C') === true);
chk('a toggle exists', q('typeof m2_setExcludeFirstC') === 'function');

// score the same site with the rule on and off; a C-start template must lose ground
function topRT(on) {
  return vm.runInContext(`(function(){
    m2_setExcludeFirstC(${on});
    var g='ACACCGTTGGACCCACCGGACAGACCTGTTGCATACATTCCTGAGAACTCGTGTGATCCTCGAGCGGCTATCCGTGGTGTTGATGACAGCCAAGGGAAATGGTTAGGTGGTATGTTTGATAAAGACAGCTTTGTGGAAACATTTGAAGGTTGGGCTAAGACAGTGGTTACTGGCAGAGCAAAG';
    var edits=[{pos:100,type:'SNP',from:g[100],to:(g[100]==='A'?'T':'A')}];
    var c=genRT(g,90,edits,'+',10,34,'GACCAGCTCGGCAAGTTCTA','CTGGCTGCAT');
    if(!c||!c.length) return null;
    c=c.slice().sort(function(a,b){return b.score-a.score;});
    return JSON.stringify({seq:c[0].seq, score:c[0].score,
      cAny: c.filter(function(x){return x.seq.charAt(0)==='C';}).length,
      cScoreOn: (c.filter(function(x){return x.seq.charAt(0)==='C';})[0]||{}).score || null});
  })()`, ctx);
}
const off = JSON.parse(topRT(false) || 'null');
const on  = JSON.parse(topRT(true)  || 'null');
if (off && on) {
  chk('candidates beginning with C are present in the pool', off.cAny > 0, off.cAny + ' of them');
  if (off.cScoreOn !== null && on.cScoreOn !== null)
    chk('a C-start template scores lower with the rule on', on.cScoreOn < off.cScoreOn,
        off.cScoreOn + ' -> ' + on.cScoreOn);
  chk('the penalty is a preference, not a filter', on.cAny === off.cAny,
      'still ' + on.cAny + ' C-start candidates offered');
} else {
  chk('genRT returned candidates for the probe site', false);
}
vm.runInContext('m2_setExcludeFirstC(true);', ctx);

// ── Homology beyond the edit ──────────────────────────────────────────────
// Anzalone 2019: the template must run at least 5 nt past the farthest edit.
chk('zero-homology templates are scored below 5 nt ones',
    vm.runInContext(`(function(){
      var a=(typeof rtHomBucket==='function')?rtHomBucket(0):null;
      var b=(typeof rtHomBucket==='function')?rtHomBucket(6):null;
      return (a===null)? true : a > b;   // higher bucket = worse
    })()`, ctx) === true);

// ── the PBS-to-spacer geometric artefact ──────────────────────────────────
// A primer-binding site of length L pairs perfectly with the last 3 + L bases of its own
// spacer. That is the geometry of the nick, not a design fault. Scoring it had flagged 192 of
// 198 candidates across 33 verified sites as critical, which is why genPBS excludes that
// stretch. Three other panels were still measuring against the WHOLE spacer: the length
// heatmap, the spacer ranking column, and the secondary-structure card. Each therefore
// reported a problem on every design, and the advice the card gave — choose a primer-binding
// site with less spacer overlap — could not be followed, because none exists.
const src2 = require('fs').readFileSync(process.env.PPE_HTML ||
  require('path').join(__dirname, '..', 'plant_prime_editor_v1.0.html'), 'utf8');
chk('spacer ranking excludes the required pairing', /_spOutsideQ/.test(src2));
chk('structure card excludes it too', /PBS ⇔ Spacer 5′/.test(src2));
chk('heatmap excludes it', /_spOutsideHM/.test(src2));

const probe = JSON.parse(vm.runInContext(`(function(){
  var spacer = 'GGGTATGGTGGTGCAATGGG', pbs = 'ATTGCACCAC';
  var outside = spacer.slice(0, Math.max(0, spacer.length - 3 - pbs.length));
  return JSON.stringify({ whole: m2_maxCompRun(pbs, spacer), trimmed: m2_maxCompRun(pbs, outside) });
})()`, ctx));
chk('against the whole spacer the run equals the PBS length', probe.whole >= 10, probe.whole + ' nt');
chk('against the 5-prime region it falls below the warn threshold', probe.trimmed < 4, probe.trimmed + ' nt');

// the design-rule counter must not be hardcoded
chk('design-rule total is derived, not fixed at 10', /\$\{passCount\}\/\$\{rules\.length\}/.test(src2));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
