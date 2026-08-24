// The heatmap above the primer-binding-site table and the table itself describe the same
// candidates. They were computing different quantities: the heatmap measured each PBS against
// the WHOLE spacer and added a PBS-to-RT term at 1.5x weight, while genPBS excludes the stretch
// of spacer a PBS necessarily pairs with and has no RT term at all — it is called before any
// RT template exists. The result was a heatmap that coloured every length red at -13.3 kcal and
// a header reading "0 low-risk lengths available", directly above a table calling every one of
// those same candidates low risk at -7 kcal.
//
// Nothing in either panel would reveal that; only comparing them does.
const vm = require('vm'), fs = require('fs'), path = require('path');
const { ctx, q } = require(path.join(__dirname, 'probe.js'));
let pass = 0, fail = 0;
const chk = (l, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '* FAIL * ') + l.padEnd(58) + (d || '')); };
const rc = s => s.split('').reverse().map(c => ({ A:'T', T:'A', G:'C', C:'G' }[c] || c)).join('');

const lines = fs.readFileSync(path.join(__dirname, '..', 'data', 'benchmark_scored.csv'), 'utf8').split('\n');
const hdr = lines[0].split(',');
const col = n => hdr.indexOf(n);

// the heatmap's own arithmetic, as the panel now performs it
function heatmapCell(pbs, spacer, len) {
  const spOut = spacer.slice(0, Math.max(0, spacer.length - 3 - len));
  return JSON.parse(vm.runInContext(`(function(){
    var a = m2_maxDuplexAndDG(${JSON.stringify(pbs)}, ${JSON.stringify(spOut)});
    var b = m2_maxDuplexAndDG(${JSON.stringify(pbs)}, _M2_SCAF_3);
    var c = m2_selfFoldDG(${JSON.stringify(pbs)});
    var w = Math.min(a.run>=2?a.dG*1.2:0, b.run>=2?b.dG*1.0:0, c.run>=2?c.dG*0.8:0);
    return JSON.stringify({ dG: w, risk: (w<-12?'critical':w<-8?'medium':w<-5?'low':'perfect') });
  })()`, ctx));
}

let checked = 0, agree = 0, compared = 0;
lines.slice(1).forEach(line => {
  if (!line.trim()) return;
  const f = line.split(',');
  const g = (f[col('genomic_seq')] || '').toUpperCase();
  const nick = parseInt(f[col('nick_pos')], 10);
  const strand = (f[col('spacer_strand')] || '').trim();
  const spacer = f[col('published_spacer')] || '';
  if (!g || !Number.isFinite(nick) || !strand || !spacer) return;
  if (checked >= 8) return;
  checked++;
  const cands = JSON.parse(vm.runInContext(
    `JSON.stringify(genPBS(${JSON.stringify(g)}, ${nick}, ${JSON.stringify(strand)}, 8, 14, ${JSON.stringify(spacer)}, true)
      .map(function(x){return {len:x.length, seq:x.seq, risk:x.structRisk, dG:x.dGworst};}))`, ctx));
  cands.forEach(c => {
    const cell = heatmapCell(c.seq, spacer, c.len);
    const same = cell.risk === c.risk && Math.abs(cell.dG - c.dG) < 0.05;
    compared++;
    if (same) agree++;
    else console.log('        disagree at ' + c.len + ' nt: table ' + c.risk + ' ' + c.dG +
                     ' vs heatmap ' + cell.risk + ' ' + cell.dG.toFixed(1));
  });
});
// FIX TAUTOLOGY (23 Aug 2026). This read `agree > 0 && agree === checked * 0 + agree`.
// The right-hand side is `agree === agree` — true for every value — so the only real
// condition was `agree > 0`: one agreeing candidate passed the check no matter how many
// disagreed. Disagreements were printed on the line above and never counted. Two separate
// mutations (a structRisk threshold, and a 1 nt genPBS window shift) both survived it.
chk('heatmap and table agree on every candidate', compared > 0 && agree === compared,
    agree + ' of ' + compared + ' candidates agree, across ' + checked + ' loci');

// the specific regressions
const src = fs.readFileSync(process.env.PPE_HTML || path.join(__dirname, '..', 'plant_prime_editor_v1.0.html'), 'utf8');
chk('heatmap excludes the spacer stretch a PBS must pair with', /_spOutsideHM/.test(src));
chk('heatmap no longer folds a PBS-to-RT term into the colour',
    !/topRT && dRT\.run >= 2 \? dRT\.dG \* 1\.5 : 0/.test(src));
chk('length range in the header is derived, not hard-coded',
    !/Lengths 11-19 nt/.test(src) && /Lengths \$\{hmPbsMin\}/.test(src));
chk('PBS column is labelled 5-prime to 3-prime',
    !/PBS Sequence \(3'→5'\)/.test(src) && /PBS Sequence \(5&prime;&rarr;3&prime;\)/.test(src));
chk('alerts are block-level so prose is not split into columns',
    /\.alert\{[^}]*display:block/.test(src) && !/\.alert\{[^}]*display:flex/.test(src));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
