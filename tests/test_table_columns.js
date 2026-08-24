// A table whose body has fewer cells than its header has columns does not look broken — it
// looks like a table with the wrong data in every column after the gap. The primer-binding-site
// table shipped with nine headers and eight cells: the Wallace melting temperature was never
// rendered, so the score appeared under "Tm (Wallace)", the structure risk under "Score", and
// "Structure risk" was empty. Every value after Tm (NN) was mislabelled, and nothing about the
// rendering said so.
//
// This counts <th> in each thead against <td> in the builder that fills the matching tbody,
// taking the assignment nearest before it — several tables call their variable "rows", so the
// first match in the file is usually the wrong one.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(process.env.PPE_HTML ||
  path.join(__dirname, '..', 'plant_prime_editor_v1.0.html'), 'utf8');
const lineOf = i => html.slice(0, i).split('\n').length;
let pass = 0, fail = 0;

const tbodies = [...html.matchAll(/<tbody>\$\{(\w+)\}<\/tbody>/g)];
if (!tbodies.length) { console.log('* FAIL * no data tables found'); process.exit(1); }

tbodies.forEach(m => {
  const varName = m[1];
  const heads = [...html.slice(0, m.index).matchAll(/<thead>[\s\S]*?<\/thead>/g)];
  if (!heads.length) return;
  const thead = heads[heads.length - 1][0];
  const nth = (thead.match(/<th\b/g) || []).length;
  const names = [...thead.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)]
    .map(x => x[1].replace(/<[^>]+>/g, '').trim().slice(0, 16));

  const assigns = [...html.slice(0, m.index).matchAll(new RegExp('const\\s+' + varName + '\\s*=', 'g'))];
  if (!assigns.length) { console.log('* FAIL * ' + varName + ': builder not found'); fail++; return; }
  const seg = html.slice(assigns[assigns.length - 1].index, m.index);
  const tr = seg.match(/<tr\b[\s\S]*?<\/tr>/);
  if (!tr) { console.log('* FAIL * ' + varName + ': no row template'); fail++; return; }
  const ntd = (tr[0].match(/<td\b/g) || []).length;
  const colspan = /colspan=/.test(tr[0]);

  const ok = colspan || ntd === nth;
  ok ? pass++ : fail++;
  console.log((ok ? '  PASS  ' : '* FAIL * ') +
    ('line ' + lineOf(m.index)).padEnd(11) + varName.padEnd(14) +
    nth + ' headers, ' + ntd + ' cells' + (colspan ? ' (colspan row)' : ''));
  if (!ok) console.log('        headers: ' + names.join(' | '));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
