/*
  make_data_s1.js — generate the four export files that Supplementary Data S1 attaches.

  Supplementary Data S1 promises "one real example of each" export format. Rather than
  hand-writing examples, this runs the shipped exporters against the worked example used
  everywhere else in the paper and writes whatever they actually produce. If an exporter
  changes, re-running this changes Data S1 with it, so the two cannot drift apart.

  Worked example: rice OsALS-T2, PE2, vector pYPQ166-OsPE2, single G to A at position 306.
  Spacer GGGTATGGTGGTGCAATGGG — the published one, third of three tied at score 80.
  Expect PBS 10 nt, RT template 17 nt, 11 nt homology beyond the edit, 19 primers.

      node analysis/make_data_s1.js [outdir]      default: DataS1/
*/
const vm = require('vm'), fs = require('fs'), path = require('path');
const HERE = __dirname;
process.env.PPE_HTML = process.env.PPE_HTML ||
  path.join(HERE, '..', 'plant_prime_editor_v1.0.html');
const { ctx } = require(path.join(HERE, '..', 'tests', 'lib', 'load_tool.js'));
const q = (e) => vm.runInContext(e, ctx, { timeout: 60000 });

const OUT = path.resolve(process.argv[2] || path.join(HERE, '..', 'DataS1'));
fs.mkdirSync(OUT, { recursive: true });

// The exporters emit in two different ways: some build a Blob and call
// URL.createObjectURL, others encode a data: URI straight onto an anchor. Both end at
// anchor.click(), so intercept there as well as at the Blob, and decode whichever arrives.
const captured = [];
ctx.Blob = class { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; } };
ctx.URL = {
  createObjectURL: (b) => { captured.push({ name: null, body: b.parts.join('') }); return 'blob:x'; },
  revokeObjectURL() {}
};
const _origCreate = ctx.document.createElement.bind(ctx.document);
ctx.document.createElement = function (tag) {
  const el = _origCreate(tag);
  if (String(tag).toLowerCase() === 'a') {
    el.click = function () {
      const href = this.href || '';
      const m = /^data:[^,]*,(.*)$/s.exec(href);
      if (m) captured.push({ name: this.download || null, body: decodeURIComponent(m[1]) });
    };
  }
  return el;
};
ctx.btoa = s => Buffer.from(s, 'binary').toString('base64');
ctx.unescape = s => s;
ctx.XMLSerializer = class { serializeToString(n) { return (n && n.__xml) || '<svg/>'; } };

const SEQ = fs.readFileSync(path.join(HERE, '..', 'data', 'sequences_plain', 'OsALS-T2.txt'), 'utf8')
              .split('\n').filter(l => !l.startsWith('>')).join('').replace(/\s+/g, '').toUpperCase();
const SPACER = 'GGGTATGGTGGTGCAATGGG';
const NICK   = 300;            // 0-based; edit sits 5 nt 3' of it
const EDITPOS = NICK + 5;      // position 306, 1-based

ctx.__seq = SEQ;
const built = q(`(function () {
  try {
    selectedVec = VECTORS.find(function (v) { return v.id === 'pYPQ166-OsPE2'; });
    if (!selectedVec) return JSON.stringify({ err: 'vector pYPQ166-OsPE2 not found' });
    selectedCloningStrategy = 'gg';
    var g = __seq, nick = ${NICK}, strand = '+', spacer = ${JSON.stringify(SPACER)};
    var from = g.charAt(${EDITPOS}), to = 'A';
    var edits = [{ genomicPos: ${EDITPOS}, type: 'SNP', ref: from, alt: to }];

    var sp = findSpacers(g, 'NGG', 20, ${EDITPOS}, edits);
    var chosen = sp.find(function (x) { return x.spacer === spacer; });
    if (!chosen) return JSON.stringify({ err: 'published spacer not returned' });

    var pbsC = genPBS(g, nick, strand, 8, 15, spacer, false);
    var rtC  = genRT(g, nick, edits, strand, 10, 34, spacer, pbsC.length ? pbsC[0].seq : '');
    rtC = rtC.slice().sort(function (a, b) { return b.score - a.score; });
    var pbs = pbsC[0], rt = rtC[0];

    designResult = { spacers: sp, pbsCandidates: pbsC, rtCandidates: rtC, nickSgRNAs: [],
                     genomicSeq: g, genomicEditPos: ${EDITPOS}, allEdits: edits,
                     geneLength: g.length, target: { seq_name: 'OsALS-T2' } };
    window.designResult = designResult;
    // The variant table is Module 1 output and is indexed in 1-based CDS coordinates, and
    // getCodonContext reads the reference from seqs[0]. Supplying the 0-based genomic index
    // and leaving seqs unset produced position 305, "---" codons and a blank impact — the
    // harness's error, not the tool's. Both are set properly here so Data S1 matches what
    // the interface shows and what Figure S3 panel A was captured from.
    frame = 1;
    seqs = [{ name: 'OsALS_ToEdit', seq: g },
            { name: 'OsALS_Ref1',   seq: g.slice(0, ${EDITPOS}) + 'A' + g.slice(${EDITPOS} + 1) }];
    window.seqs = seqs;
    window._lastResult = { nt_variants: [{ position: ${EDITPOS} + 1, ref: from, var: to,
                                           type: 'SNP', seq_name: 'OsALS_Ref1' }],
                           summary: { n_nt_variants: 1 } };
    window._handoffMeta = { organism: 'Oryza sativa', accession: 'OsALS-T2',
                            name: 'OsALS', source: 'User input', note: '' };

    m2Data = { peSystem: 'PE2', spacer: { spacer: spacer }, rt: { seq: rt.seq }, pbs: { seq: pbs.seq },
               selectedNick: null, nickSgRNAs: [], twinSpacer: null,
               twinPBS: [{ seq: pbs.seq }], twinRT: [{ seq: rt.seq }], locus: 'OsALS-T2' };
    window._m3EditableSeqs = null; allPrimers.length = 0;
    runPrimerDesign();

    return JSON.stringify({ spacer: spacer, pbsLen: pbs.seq.length, rtLen: rt.seq.length,
                            homology: rt.homologyBeyondEdit, primers: allPrimers.length,
                            vector: selectedVec.id, enzyme: selectedVec.enzyme });
  } catch (e) { return JSON.stringify({ err: e.message }); }
})()`);

const d = JSON.parse(built);
if (d.err) { console.error('design failed:', d.err); process.exit(1); }
console.log('  worked example rebuilt');
console.log('    spacer %s · PBS %d nt · RT %d nt · homology %d nt · %d primers · %s (%s)',
            d.spacer, d.pbsLen, d.rtLen, d.homology, d.primers, d.vector, d.enzyme);
if (d.pbsLen !== 10 || d.rtLen !== 17 || d.homology !== 11) {
  console.error('  ! geometry differs from the published worked example (expected 10 / 17 / 11)');
  console.error('    Data S1 and the manuscript would disagree — not writing files.');
  process.exit(1);
}

// exportCSV calls getCodonContext, which renderResults declares and then exposes on
// window (see FIX CSV-EXPORT-SCOPE in the tool). In a browser renderResults has always run
// before the CSV button exists, so the function is there. Headlessly there is no DOM to
// render into, so lift the same declaration out of the tool source and evaluate it in the
// global scope — the tool's own code, unmodified, in the state the browser would be in.
{
  const src = fs.readFileSync(process.env.PPE_HTML, 'utf8');
  const at = src.indexOf('  function getCodonContext(');
  if (at < 0) { console.error('  getCodonContext not found in the tool source'); process.exit(1); }
  let open = src.indexOf('{', at), depth = 0, end = open;
  while (end < src.length) {
    if (src[end] === '{') depth++;
    else if (src[end] === '}') { depth--; if (!depth) break; }
    end++;
  }
  q(src.slice(at, end + 1));                 // declares it globally, exactly as written
  q('window.getCodonContext = getCodonContext;');
}
console.log('  getCodonContext available:', q('typeof getCodonContext'));

const EXPORTS = [
  ['exportIDT()',      'S1a_synthesis_vendor_bulk_order.csv', 'synthesis-vendor bulk order'],
  ['exportTwist()',    'S1b_fragment_order_specification.csv', 'fragment order specification'],
  ['exportCSV()',      'S1c_variant_table.csv',                'variant table'],
  ['exportProtocol()', 'S1d_bench_protocol.txt',               'printable bench protocol'],
];

let written = 0;
for (const [call, fname, label] of EXPORTS) {
  const before = captured.length;
  try { q(call); } catch (e) { console.error('  ' + label.padEnd(34) + ' FAILED: ' + e.message); continue; }
  const made = captured.slice(before);
  if (!made.length) { console.error('  ' + label.padEnd(34) + ' produced no file'); continue; }
  const body = made[made.length - 1].body;
  fs.writeFileSync(path.join(OUT, fname), body);
  console.log('  ' + label.padEnd(34) + ' -> ' + fname.padEnd(40) +
              String(body.length).padStart(6) + ' bytes, ' + body.split('\n').length + ' lines');
  written++;
}

console.log('\n  %d of %d exports written to %s', written, EXPORTS.length, OUT);
if (written !== EXPORTS.length) process.exit(1);
