// Two things that are easy to break silently: the build stamp that makes a design traceable,
// and the off-target hand-off. Neither is exercised by any other test.
const vm = require('vm'), path = require('path');
const { ctx, q } = require(path.join(__dirname, 'probe.js'));
let pass = 0, fail = 0;
const chk = (l, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '* FAIL * ') + l.padEnd(56) + (d || '')); };

// ── build identity ────────────────────────────────────────────────────────
chk('PPE_BUILD exists', q('typeof PPE_BUILD') === 'object');
const fp = q('PPE_BUILD.fingerprint');
chk('fingerprint is eight hex characters', /^[0-9a-f]{8}$/.test(String(fp)), String(fp));
chk('stamp names the version and the fingerprint',
    /v1\.0/.test(q('PPE_BUILD.stamp')) && q('PPE_BUILD.stamp').indexOf(fp) >= 0, q('PPE_BUILD.stamp'));
chk('fingerprint is stable across calls', q('PPE_BUILD.fingerprint') === fp);

// changing a design parameter must change the fingerprint, or it is decorative
const moved = vm.runInContext(`(function(){
  var keep = VECTORS[0].overhang_5;
  VECTORS[0].overhang_5 = 'TTTT';
  var f2 = PPE_BUILD.recompute();
  VECTORS[0].overhang_5 = keep;
  var f3 = PPE_BUILD.recompute();
  return JSON.stringify({changed: f2, restored: f3});
})()`, ctx);
const mv = JSON.parse(moved);
chk('changing an overhang changes the fingerprint', mv.changed !== fp, fp + ' -> ' + mv.changed);
chk('restoring it restores the fingerprint', mv.restored === fp);

const ruleMoved = vm.runInContext(`(function(){
  m2_setExcludeFirstC(false); var a = PPE_BUILD.recompute();
  m2_setExcludeFirstC(true);  var b = PPE_BUILD.recompute();
  return JSON.stringify({off:a, on:b});
})()`, ctx);
const rm = JSON.parse(ruleMoved);
chk('toggling a scoring rule changes the fingerprint', rm.off !== rm.on, rm.off + ' vs ' + rm.on);
chk('the rule is left on afterwards', q('M2_EXCLUDE_FIRST_C') === true);

// ── off-target hand-off ───────────────────────────────────────────────────
chk('exporter exists', q('typeof exportOffTargetInputs') === 'function');
const guides = vm.runInContext(`(function(){
  m2Data = { peSystem:'PE3', spacer:{spacer:'GACCAGCTCGGCAAGTTCTA'},
             selectedNick:{spacer:'TTGCAGTCCATGGATCCTAA'}, nickSgRNAs:[{spacer:'TTGCAGTCCATGGATCCTAA'}] };
  return JSON.stringify(m3_offTargetGuides());
})()`, ctx);
const g = JSON.parse(guides);
chk('pegRNA spacer and nicking sgRNA are both listed', g.length === 2, g.map(x => x.id).join(', '));
chk('spacers are clean ACGT', g.every(x => /^[ACGT]{17,25}$/.test(x.spacer)));
chk('a duplicate spacer is not listed twice',
    JSON.parse(vm.runInContext(`(function(){
      m2Data = { spacer:{spacer:'GACCAGCTCGGCAAGTTCTA'}, selectedNick:{spacer:'GACCAGCTCGGCAAGTTCTA'} };
      return JSON.stringify(m3_offTargetGuides());
    })()`, ctx)).length === 1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
