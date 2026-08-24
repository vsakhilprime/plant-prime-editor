/*
  test_csv_export_scope.js

  exportCSV is a global function wired to onclick="exportCSV()". It calls getCodonContext,
  which is declared inside renderResults. A global handler cannot see a function scoped to
  another function's body, so the variant-table CSV button threw
  "getCodonContext is not defined" and produced nothing at all.

  The fix exposes it: renderResults assigns window.getCodonContext immediately after the
  declaration. This test guards both halves of that.

    1  the exposure line is present and sits at the top level of renderResults, so it runs
       unconditionally whenever results are rendered rather than inside some branch
    2  given that exposure, exportCSV actually produces a well-formed variant table

  Part 2 evaluates the tool's own getCodonContext source in the global scope, which is the
  state a browser is in after any render. Nothing is reimplemented.
*/
const vm = require('vm'), fs = require('fs'), path = require('path');
process.env.PPE_HTML = process.env.PPE_HTML || process.argv[2] ||
  path.join(__dirname, '..', 'plant_prime_editor_v1.0.html');
const { ctx } = require('./lib/load_tool.js');
const q = (e) => vm.runInContext(e, ctx, { timeout: 20000 });

let fails = 0;
const ok   = (n, d) => console.log('  PASS  ' + n + (d ? '  (' + d + ')' : ''));
const bad  = (n, d) => { fails++; console.log('  FAIL  ' + n + (d ? '  (' + d + ')' : '')); };

const src = fs.readFileSync(process.env.PPE_HTML, 'utf8');

// ── 1. the exposure exists, at the top level of renderResults ────────────────
(function () {
  const ri = src.indexOf('function renderResults');
  if (ri < 0) return bad('renderResults found in source');
  let open = src.indexOf('{', ri), depth = 0, end = open;
  while (end < src.length) {
    if (src[end] === '{') depth++;
    else if (src[end] === '}') { depth--; if (!depth) break; }
    end++;
  }
  const body = src.slice(open, end + 1);
  const k = body.indexOf('window.getCodonContext = getCodonContext;');
  if (k < 0) return bad('getCodonContext is exposed on window',
                        'exportCSV will throw when the CSV button is clicked');
  const d = (body.slice(0, k).match(/{/g) || []).length - (body.slice(0, k).match(/}/g) || []).length;
  d === 1 ? ok('getCodonContext exposed at the top level of renderResults', 'depth ' + d)
          : bad('getCodonContext exposed unconditionally', 'nested at depth ' + d);
})();

// ── 2. with that exposure, exportCSV produces a real variant table ───────────
(function () {
  const at = src.indexOf('  function getCodonContext(');
  if (at < 0) return bad('getCodonContext found in source');
  let open = src.indexOf('{', at), depth = 0, end = open;
  while (end < src.length) {
    if (src[end] === '{') depth++;
    else if (src[end] === '}') { depth--; if (!depth) break; }
    end++;
  }
  q(src.slice(at, end + 1));                       // the tool's own code, unmodified

  const captured = [];
  const orig = ctx.document.createElement.bind(ctx.document);
  ctx.document.createElement = function (tag) {
    const el = orig(tag);
    if (String(tag).toLowerCase() === 'a') {
      el.click = function () {
        const m = /^data:[^,]*,(.*)$/s.exec(this.href || '');
        if (m) captured.push(decodeURIComponent(m[1]));
      };
    }
    return el;
  };

  const seq = fs.readFileSync(
    path.join(__dirname, 'data', 'sequences_plain', 'OsALS-T2.txt'), 'utf8')
    .split('\n').filter(l => !l.startsWith('>')).join('').replace(/\s+/g, '').toUpperCase();
  ctx.__seq = seq;
  q(`
    frame = 1;
    seqs = [{ name:'ToEdit', seq: __seq },
            { name:'Ref1',   seq: __seq.slice(0,305) + 'A' + __seq.slice(306) }];
    window.seqs = seqs;
    window._lastResult = { nt_variants: [{ position: 306, ref: 'G', var: 'A',
                                           type: 'SNP', seq_name: 'Ref1' }],
                           summary: { n_nt_variants: 1 } };
  `);

  try { q('exportCSV()'); }
  catch (e) { return bad('exportCSV() runs', e.message); }

  if (!captured.length) return bad('exportCSV() emits a file');
  const rows = captured[captured.length - 1].trim().split('\n');
  if (rows.length < 2) return bad('CSV has a data row', rows.length + ' rows');

  const cells = rows[1].split(',');
  const [pos, codonPos, tgt, ref] = cells;
  pos === '306'            ? ok('position is 1-based CDS', pos)            : bad('position is 1-based CDS', pos);
  /3rd/.test(codonPos)     ? ok('codon position resolved', codonPos)       : bad('codon position resolved', codonPos);
  (tgt === 'AGG' && ref === 'AGA')
    ? ok('codons resolved from the reference', tgt + ' vs ' + ref)
    : bad('codons resolved from the reference', tgt + ' vs ' + ref);
  /Synonymous/.test(rows[1]) ? ok('protein impact classified', 'Synonymous')
                             : bad('protein impact classified', rows[1].split(',').pop());
})();

console.log(fails ? '\n  ' + fails + ' failed' : '\n  All CSV export scope checks pass.');
process.exit(fails ? 1 : 0);
