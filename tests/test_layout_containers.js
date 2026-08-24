// Layout faults in this file have all had the same shape: a flex container built for one
// purpose later used for another. .alert was display:flex, so prose containing <strong> was
// laid out as a row of narrow columns. The protocol footer was a flex row for three buttons,
// and the entire tail of the step was subsequently added inside it — reuse guide, export row,
// primer table, final report — so each became a column, the earlier ones rendered as empty
// boxes, and the last panel was pushed off the right edge where it could not be reached.
//
// Neither is visible from the code unless you look for it, and neither throws. These assertions
// hold the two invariants that prevent the pattern recurring.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(process.env.PPE_HTML ||
  path.join(__dirname, '..', 'plant_prime_editor_v1.0.html'), 'utf8');
const lineOf = i => html.slice(0, i).split('\n').length;
let pass = 0, fail = 0;
const chk = (l, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '* FAIL * ') + l.padEnd(60) + (d || '')); };

// 1. alerts carry prose, so they must not be flex
chk('.alert is block-level', /\.alert\{[^}]*display:block/.test(html) && !/\.alert\{[^}]*display:flex/.test(html));

// 2. no flex row may hold both interactive controls and a table
const offenders = [];
[...html.matchAll(/<div style="display:flex;gap:\d+px[^"]*">/g)].forEach(m => {
  const after = m.index + m[0].length;
  const seg = html.slice(after, after + 4000);
  const end = seg.indexOf('\n      </div>');
  const body = seg.slice(0, end > 0 ? end : 4000);
  if (/<table/.test(body) && /<button/.test(body)) offenders.push(lineOf(m.index));
});
chk('no flex row mixes buttons with a table', offenders.length === 0,
    offenders.length ? 'lines ' + offenders.join(', ') : 'checked every flex row');

// 3. the wide primer reference must be reachable rather than overflowing
const t = html.indexOf('All Primers — Quick Reference');
const around = html.slice(Math.max(0, t - 400), t + 400);
chk('primer reference scrolls horizontally', /overflow-x:auto/.test(around));
chk('primer reference keeps a minimum width so columns do not crush',
    /min-width:\d+px/.test(html.slice(t, t + 900)));

// 4. the protocol tail stacks
chk('protocol tail is a block container', /FIX PROTOCOL-TAIL-LAYOUT/.test(html) &&
    /<div style="display:block">/.test(html));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
