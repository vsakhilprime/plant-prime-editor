// check_export_transcript_length.js
//
// One pegRNA, one length. The tool states the assembled transcript's length in
// four independent places and they must agree:
//
//   1. the Module 2 panel convention  spacer + scaffold + RT + PBS (+ linker +
//      tevopreQ1 on tevo systems) + poly-T                      -> "Transcript (nt)"
//   2. collectAllResults().assembled_pegRNA.total_nt            -> JSON / CSV / HTML report
//   3. the FASTA export's pegRNA-1 record
//   4. analysis/worked_example.json expect.insert_len           -> what the paper prints
//
// REGRESSION THIS CATCHES.  Until 20 September 2026 (1) counted the poly-T
// terminator and (2) did not, so a live run exported "Assembled pegRNA - 122 nt"
// and total_nt,122 while the panel on screen, the FASTA record and the manuscript
// all said 128. Nothing compared them. This does.
//
// Run:  node analysis/check_export_transcript_length.js

const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.PPE_HTML = path.join(ROOT, 'plant_prime_editor_v1.0.html');
const { ctx } = require(path.join(ROOT, 'tests', 'lib', 'load_tool.js'));
const q = e => vm.runInContext(e, ctx, { timeout: 20000 });

const W = JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis', 'worked_example.json'), 'utf8'));
const seq = fs.readFileSync(path.join(ROOT, W.sequence_file), 'utf8').trim();

// Capture downloads instead of writing them. The tool uses two mechanisms: the
// three all-results exporters go through a Blob, the per-table exporters and
// exportFASTA build a data: URI on an anchor and click it. Catch both.
const captured = [];
ctx.Blob = class { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; } };
ctx.URL = { createObjectURL: b => { captured.push({ type: b.type, body: b.parts.join('') }); return 'blob:x'; },
            revokeObjectURL() {} };
const _mk = ctx.document.createElement;
ctx.document.createElement = function (tag) {
  const el = _mk(tag);
  el.click = function () {
    const href = String(el.href || '');
    const m = href.match(/^data:([^;,]+)[^,]*,([\s\S]*)$/);
    if (m) captured.push({ type: m[1], body: decodeURIComponent(m[2]) });
  };
  return el;
};

ctx.__seq = seq;
ctx.__W = JSON.parse(JSON.stringify(W));

// Build the worked example exactly as the record defines it: published edit,
// published spacer choice, interface default search bounds.
const built = q(`
  var _e  = [{ genomicPos: __W.edit_pos0, type: 'SNP',
               ref: __seq[__W.edit_pos0], alt: __W.edit_to }];
  var _all = findSpacers(__seq, 'NGG', 20, __W.edit_pos0, _e);
  var _i   = _all.findIndex(function(s){ return s.spacer === __W.spacer; });
  if (_i < 0) throw new Error('the worked example spacer is not among the candidates');
  var _sp  = _all[_i];
  var _pb  = genPBS(__seq, _sp.nickPosGenomic, _sp.strand, __W.pbs_min, __W.pbs_max, _sp.spacer);
  var _rt  = genRT(__seq, _sp.nickPosGenomic, _e, _sp.strand, __W.rt_min, __W.rt_max,
                   _sp.spacer, _pb[0].seq);
  designResult = { spacers: _all, pbsCandidates: _pb, rtCandidates: _rt, nickSgRNAs: [],
                   genomicSeq: __seq, genomicEditPos: __W.edit_pos0, allEdits: _e,
                   geneLength: __seq.length, target: { seq_name: 'OsALS' } };
  window.designResult = designResult;
  selSpacer = _i; selPBS = 0; selRT = 0;
  peSystem  = __W.pe_system;
  JSON.stringify({ spacer: _sp.spacer, nick: _sp.nickPosGenomic, strand: _sp.strand,
                   pbs: _pb[0].seq, rt: _rt[0].seq, rank: _i + 1, n: _all.length });
`);
const b = JSON.parse(built);

let P = 0, F = 0;
const ck = (name, cond, detail) => { cond ? P++ : F++;
  console.log((cond ? '  PASS  ' : '* FAIL *') + ' ' + String(name).padEnd(60) + (detail || '')); };

console.log('worked example: ' + W.locus + '  spacer ' + b.spacer + ' (rank ' + b.rank +
            ' of ' + b.n + ')  nick g.' + b.nick + b.strand);
console.log('                PBS ' + b.pbs + ' (' + b.pbs.length + ' nt)   RT ' +
            b.rt + ' (' + b.rt.length + ' nt)\n');

ck('PBS is the one the record expects', b.pbs === W.expect.pbs, b.pbs);
ck('RT template is the one the record expects', b.rt === W.expect.rt, b.rt);

// 1. Module 2 panel convention, recomputed from the same globals the panel uses.
const panel = Number(q(`
  (function(){
    var sp = designResult.spacers[selSpacer], pb = designResult.pbsCandidates[selPBS],
        rt = designResult.rtCandidates[selRT];
    var isTevo = ['PE2max','ePPE','PPE','ePPE3'].indexOf(peSystem) >= 0;
    var lk = (typeof m2_computedLinker === 'string' && m2_computedLinker) ? m2_computedLinker : LINKER;
    return (sp.spacer + M2_SCAFFOLD + rt.seq + pb.seq +
            (isTevo ? lk + TEVO : '') + POLY_T_TERM).length;
  })()
`));

// 1b. What Module 2 actually PRINTS. The stat box and the block headed "Full pegRNA
// sequence" sit two centimetres apart on the same screen — the one Supplementary
// Figure S3 photographs — so the letters in the block must be the number in the box.
const asm = _mk('div');
const _gbi = ctx.document.getElementById;
ctx.document.getElementById = id => (id === 'asm-result' ? asm : _gbi(id));
try { q('renderAssembly(designResult)'); } catch (e) { console.log('renderAssembly threw: ' + e.message); }
ctx.document.getElementById = _gbi;

const html = String(asm.innerHTML || '');
const strip = s => s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, '').replace(/\s+/g, '');
// the sequence block follows the "Full pegRNA sequence" label
const mSeq = html.match(/Full pegRNA sequence[\s\S]{0,400}?word-break:break-all[^>]*>([\s\S]*?)<\/div>/);
const panelSeq = mSeq ? strip(mSeq[1]) : '';
// the stat box labelled "Transcript (nt)"
const mBox = html.match(/<div class="sv">(\d+)<\/div><div class="sl">Transcript \(nt\)/);
const panelBox = mBox ? Number(mBox[1]) : null;

console.log('');
ck('Module 2 renders a full-sequence block', panelSeq.length > 0, panelSeq.length + ' nt printed');
ck('the printed sequence is as long as the box states', panelSeq.length === panelBox,
   'printed ' + panelSeq.length + '  box ' + panelBox);
ck('the printed sequence ends in the poly-T terminator', /T{4,}$/.test(panelSeq),
   panelSeq.slice(-8));
ck('the structure strip shows the terminator as its own block',
   /Poly-T \(\d+ nt\)/.test(html), (html.match(/Poly-T \(\d+ nt\)/) || [''])[0]);

// 2. the export collector
const d = q('JSON.parse(JSON.stringify(collectAllResults()))');
const a = d.assembled_pegRNA;

// 3. the FASTA export
captured.length = 0;
q('exportFASTA()');
const fasta = (captured[0] || {}).body || '';
const fastaSeq = (fasta.split('\n').filter(l => l && l[0] !== '>')[0] || '').trim();

console.log('');
ck('export reports a transcript at all', !!(a && a.full_sequence), a ? a.total_nt + ' nt' : '(none)');
ck('export sequence == what Module 2 prints on screen', !!(a && panelSeq === a.full_sequence),
   panelSeq === (a && a.full_sequence) ? 'identical' : 'differ');
ck('export total == Module 2 panel total', a && a.total_nt === panel,
   'export ' + (a && a.total_nt) + '  panel ' + panel);
ck('export total == FASTA record length', a && fastaSeq.length === a.total_nt,
   'FASTA ' + fastaSeq.length);
ck('export sequence == FASTA record sequence', a && fastaSeq === a.full_sequence);
ck('export transcript ends in the poly-T terminator',
   a && /T{4,}$/.test(a.full_sequence), a ? a.full_sequence.slice(-8) : '');
ck('export carries the terminator as its own field',
   a && typeof a.poly_t_terminator === 'string' && a.poly_t_terminator.length > 0,
   a ? a.poly_t_terminator : '');
ck('parts sum to the whole', a &&
   (a.spacer + a.scaffold + a.rt_template + a.pbs + (a.linker || '') +
    (a.tevopreQ1 || '') + (a.poly_t_terminator || '')) === a.full_sequence);
ck('as-cloned is exactly one G longer', a &&
   a.total_nt_as_cloned === a.total_nt + (a.spacer[0] === 'G' ? 0 : 1),
   a ? a.total_nt_as_cloned + ' nt' : '');

// 4. what the paper prints
console.log('');
ck('export total == worked_example.json expect.insert_len',
   a && a.total_nt === W.expect.insert_len,
   'export ' + (a && a.total_nt) + '  record ' + W.expect.insert_len);

// The exported CSV and HTML report are built from the same object; make sure the
// number that reaches a reader's eye is the same one.
captured.length = 0;
q('downloadAllResultsCSV()');
const csv = ((captured[0] || {}).body || '').split('\n');
let csvTotal = null;
for (let i = 0; i < csv.length; i++) {
  if (csv[i].trim() !== '# ASSEMBLED pegRNA') continue;
  const cols = csv[i + 1].split(',');
  const vals = csv[i + 2].split(',');
  const j = cols.indexOf('total_nt');
  if (j >= 0) csvTotal = Number(vals[j]);
  break;
}
ck('downloadAllResultsCSV prints the same total', csvTotal === a.total_nt,
   csvTotal === null ? '(no ASSEMBLED pegRNA section)' : csvTotal + ' nt');

captured.length = 0;
q('downloadAllResultsReport()');
const rep = ((captured[0] || {}).body || '').match(/Assembled pegRNA — (\d+) nt/);
ck('downloadAllResultsReport prints the same total', !!(rep && Number(rep[1]) === a.total_nt),
   rep ? rep[1] + ' nt' : '(no total found)');

// 5. The paired architectures have a length box of their own. renderTwinPE built its
// two sequences by a third local concatenation, so "pegRNA1 / 2 length" read 6 nt
// short of the Transcript box for the same pegRNA-1. Run a real PPE design through
// the tool's own design() and read that box.
console.log('');
const twinBuilt = q(`
  (function () {
    try {
      entryMode = 'direct';
      peSystem  = 'PPE';
      directEdits.length = 0;
      directEdits.push({ pos: String(__W.edit_pos1), ref: __seq[__W.edit_pos0], alt: __W.edit_to });
      var r = design(__seq);
      designResult = r; window.designResult = r;
      selSpacer = 0; selPBS = 0; selRT = 0; selTwinSpacer = 0;
      return JSON.stringify({ twins: (r.twinSpacers || []).length,
                              hasBest: !!r.twinBestSpacer });
    } catch (e) { return JSON.stringify({ err: e.message }); }
  })()
`);
const tb = JSON.parse(twinBuilt);
if (tb.err || !tb.hasBest) {
  ck('a paired (PPE) design builds, so its length box can be read', false,
     tb.err || 'no compatible second pegRNA');
} else {
  const twinEl = _mk('div');
  const _gbi2 = ctx.document.getElementById;
  ctx.document.getElementById = id => (id === 'twin-result' ? twinEl : _gbi2(id));
  let twinHtml = '';
  try { q('renderTwinPE(designResult)'); twinHtml = String(twinEl.innerHTML || ''); }
  catch (e) { twinHtml = ''; console.log('renderTwinPE threw: ' + e.message); }
  ctx.document.getElementById = _gbi2;

  // the FASTA export writes both pegRNAs with the terminator; that is the reference
  captured.length = 0;
  q('exportFASTA()');
  const fa = ((captured[0] || {}).body || '').split('\n').filter(l => l && l[0] !== '>');
  const mTwin = twinHtml.match(/<div class="sv">(\d+) \/ (\d+) nt<\/div>/);

  ck('the paired panel prints a pegRNA1 / 2 length box', !!mTwin,
     mTwin ? mTwin[1] + ' / ' + mTwin[2] + ' nt' : '(not found)');
  ck('paired pegRNA-1 length == its FASTA record',
     !!(mTwin && fa[0] && Number(mTwin[1]) === fa[0].trim().length),
     mTwin && fa[0] ? mTwin[1] + ' vs ' + fa[0].trim().length : '');
  ck('paired pegRNA-2 length == its FASTA record',
     !!(mTwin && fa[1] && Number(mTwin[2]) === fa[1].trim().length),
     mTwin && fa[1] ? mTwin[2] + ' vs ' + fa[1].trim().length : '');
}

console.log('\n' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
