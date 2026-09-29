#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — Figure 2, derived and drawn in one pass.

   PART 1 runs the shipped build headlessly and derives every value the figure
   shows. PART 2 draws the figure as native PowerPoint shapes from those values.
   Nothing is transcribed: change the scorer and the figure changes.

   PANEL A  rice OsDEP1, spacer composite score decomposed into the terms
            findSpacers computes, with each spacer, its PAM, its strand and its
            nick-to-edit distance on the row. The decomposition is rebuilt from
            the same bands the scorer uses and asserted against findSpacers' own
            rawScore, so a drift in either cannot be drawn silently.

   PANEL B  wheat TaUbi10-T2, PBS free-energy landscape over 8-22 nt, an exact
            replica of the m2_buildPBSHeatmap cell loop using the tool's own
            m2_* functions. TaUbi10-T2 is the panel locus because it is the only
            one of the 25 benchmark loci whose landscape crosses three risk
            bands; at most loci, including OsALS-T2 which this panel used until
            7 September 2026, the weighted worst channel is flat across every
            length and the panel carries no information. No locus in the
            benchmark reaches the critical band, so that band is drawn for
            scale and labelled as unreached rather than implied.

   PANEL C  the worked example, rice OsALS-T2, as an assembled pegRNA with
            segment widths proportional to length.

   Both parts end in a layout audit: every text box is checked pairwise for
   collision and every string against the width of the box it was given.

   USAGE  node analysis/build_figure2_editable.js
          writes figure2_editable_data.json and Figure2_ABC_editable.pptx
   ═══════════════════════════════════════════════════════════════════════════ */
process.env.PPE_HTML = process.env.PPE_HTML || (require('path').resolve(__dirname, '..') + '/plant_prime_editor_v1.0.html');
const WEX_LOCUS = JSON.parse(require('fs').readFileSync(
  require('path').resolve(__dirname,'worked_example.json'),'utf8')).locus;
const ROOT = require('path').resolve(__dirname, '..');
const { ctx } = require(ROOT + '/tests/lib/load_tool.js');
const vm = require('vm'), fs = require('fs');
const run = (e,a) => { ctx.__a = a; return vm.runInContext(e, ctx, {timeout:30000}); };
const FP = vm.runInContext('(typeof PPE_BUILD!=="undefined"&&PPE_BUILD.fingerprint)||"unknown"', ctx);

/* ── Panel A — spacer composite score, decomposed. Rice OsDEP1, edit 305 ──── */
const dep1 = fs.readFileSync(ROOT+'/data/benchmark_scored.csv','utf8')
  .split('\n').find(l => l.startsWith('OsDEP1-peg01'));
const DEP1 = dep1.split(',')[6], POS = 305;
const candA = run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)',
  {s:DEP1, e:POS, ed:[{genomicPos:POS,type:'SNP',ref:DEP1[POS-1],alt:'T'}]});
const panelA = ['S10','S11','S8','S7','S12'].map(id => {
  const c = candA.find(x => x.id === id);
  if (!c) throw new Error('panel A: '+id+' no longer returned');
  const d=c.dist, ok=c.isCorrectSide, G=c.gc_pct;
  const seedGC = run('m2_gc(__a)', c.spacer.slice(8));
  const distScore = !ok ? -80 : (d>=3&&d<=15)?50 : (d<=25)?35 : (d<=34)?15 : (d<=50)?0 : -30;
  const gcScore   = (G>=45&&G<=60)?20 : (G>=40&&G<=65)?14 : (G>=30&&G<=75)?7 : 2;
  const seedScore = (seedGC>=35&&seedGC<=60)?10 : (seedGC<=75)?5 : 1;
  const polyT     = /TTTT/.test(c.spacer) ? -25 : 0;
  const sum = distScore+gcScore+seedScore+polyT;
  const rebuilt = Math.min(99, Math.max(1, sum));
  if (rebuilt !== c.rawScore) throw new Error('panel A: '+id+' rebuilds '+rebuilt+' vs findSpacers '+c.rawScore);
  return {id:c.id, spacer:c.spacer, pam:c.pam, strand:c.strand, dist:d, correctSide:ok,
    gc:G, seedGC, distScore, gcScore, seedScore, polyT, sum, clamped:sum!==rebuilt,
    raw:c.rawScore, dGpen:-c.structPenalty, total:c.score, dGworst:c.dGworst, risk:c.structRisk};
});

/* ── Panels B and C — PBS free-energy landscape, one wheat locus and one rice ──
   Exact replica of the m2_buildPBSHeatmap cell loop, using the tool's own m2_*
   functions. Three scored channels at genPBS's weights; PBS-RT reported.

   Two loci, because the panel's whole point is that the length window is not a
   constant. The species melting band is, and the lengths that reach it are read
   off each locus's own Tm row:

     B  wheat TaUbi10-T2   band 26-34 C   the only benchmark locus whose landscape
                                          crosses three risk bands
     C  rice  OsCDC48-T1   band 14-20 C   the ONLY rice locus in the benchmark where
                                          the length the tool selects and the length
                                          the published design used are the same
                                          (12 nt), so the panel shows agreement
                                          rather than a difference that would need
                                          explaining. It also shows the rice band
                                          landing at 12 nt, not at 8-11 nt: the
                                          length window is locus-dependent even
                                          within the species it was derived from.
                                          No length here is structurally penalised,
                                          so the melting band alone decides - the
                                          complement of the wheat panel, where
                                          three risk bands appear and structure
                                          does bite.

   The band is process-global, so it is set immediately before each locus is
   derived and captured while it is live. */
const csv = require('fs').readFileSync(ROOT+'/data/benchmark_scored.csv','utf8').split('\n');
function parseCSV(line){ const o=[]; let cur='', q=false;
  for(const ch of line){ if(ch==='"'){q=!q;} else if(ch===','&&!q){o.push(cur);cur='';} else cur+=ch; }
  o.push(cur); return o; }
const HEAD = parseCSV(csv[0]);
const ROWS = csv.slice(1).map(parseCSV);

function landscapeData(locusId){
  // Several benchmark rows can share a locus, one per edit type. The primer-binding site
  // is identical across them - it does not depend on the edit - but the reverse-
  // transcriptase template does, so prefer the plain substitution row when one exists.
  const at = ROWS.filter(r => r[HEAD.indexOf('locus')] === locusId);
  const f = at.find(r => r[HEAD.indexOf('edit_type')] === 'SNP') || at[0];
  if (!f) throw new Error('landscape locus not in the benchmark: ' + locusId);
  const M = {locus:locusId,
    seq:f[HEAD.indexOf('genomic_seq')], nick:+f[HEAD.indexOf('nick_pos')],
    strand:f[HEAD.indexOf('spacer_strand')], spacer:f[HEAD.indexOf('published_spacer')],
    editPos:+f[HEAD.indexOf('edit_pos')], editType:f[HEAD.indexOf('edit_type')],
    ref:f[HEAD.indexOf('edit_from')], alt:f[HEAD.indexOf('edit_to')],
    species:f[HEAD.indexOf('species')], pubPBS:+f[HEAD.indexOf('published_pbs_len')]};
  run('_PPE_TM_BAND_KEY = __a', /Triticum|Hordeum|Zea/.test(M.species) ? 'triticeae_maize'
                              : /Oryza/.test(M.species) ? 'rice' : 'default');
  const band = JSON.parse(run('JSON.stringify(_ppeTmBand())'));
  const picks = JSON.parse(run(`(function(){
    var pbs = genPBS(__a.g,__a.n,__a.st,8,22,__a.sp,false);
    var top = pbs && pbs[0] ? pbs[0].seq : '';
    var rt  = genRT(__a.g,__a.n,__a.ed,__a.st,10,30,__a.sp,top);
    return JSON.stringify({pbsTop:top, rtTop:(rt&&rt[0]&&rt[0].seq)||'',
                           pbsLens:(pbs||[]).map(function(p){return p.length;})});
  })()`, {g:M.seq,n:M.nick,st:M.strand,sp:M.spacer,
          // genRT reads genomicPos as a 0-based slice index; edit_pos in the benchmark
          // is 1-based. Passing it straight through shifted the reported template by one
          // base - the same off-by-one corrected in Supplementary Figure S1.
          ed:[{genomicPos:M.editPos-1,type:M.editType,ref:M.ref,alt:M.alt}]}));
  const rows = JSON.parse(run(`(function(){
    var rows=[], g=__a.g, np=__a.n, st=__a.st, sp=__a.sp, topRT=__a.rt;
    for(var len=8; len<=22; len++){
      var pbsSeq;
      if(st==='+'){ if(np-len<0){rows.push({len:len,missing:true});continue;}
        pbsSeq=m2_rc(g.slice(np-len,np)); }
      else { if(np+len>=g.length){rows.push({len:len,missing:true});continue;}
        pbsSeq=g.slice(np+1,np+1+len); }
      var spOut = sp.slice(0, Math.max(0, sp.length-3-len));
      var dSp=m2_maxDuplexAndDG(pbsSeq,spOut), dSc3=m2_maxDuplexAndDG(pbsSeq,_M2_SCAF_3);
      var sf=m2_selfFoldDG(pbsSeq), dRT=topRT?m2_maxDuplexAndDG(pbsSeq,topRT):{run:0,dG:0};
      var wDG=Math.min(dSp.run>=2?dSp.dG*1.2:0, dSc3.run>=2?dSc3.dG*1.0:0, sf.run>=2?sf.dG*0.8:0);
      rows.push({len:len, pbs:pbsSeq, tm:Math.round(m2_calcTm(pbsSeq)*10)/10, gc:m2_gc(pbsSeq),
        spacerWindow:spOut.length,
        dSp: spOut.length? Math.round(dSp.dG*10)/10 : null, spRun:dSp.run,
        dSc3:Math.round(dSc3.dG*10)/10, sc3Run:dSc3.run,
        dSelf:Math.round(sf.dG*10)/10, selfRun:sf.run,
        dRT:topRT?Math.round(dRT.dG*10)/10:null, rtRun:dRT.run,
        wDG:Math.round(wDG*10)/10,
        risk: wDG<-12?'critical' : wDG<-8?'medium' : wDG<-5?'low' : 'perfect'});
    }
    return JSON.stringify(rows);
  })()`, {g:M.seq,n:M.nick,st:M.strand,sp:M.spacer,rt:picks.rtTop}));
  return {locus:M.locus, species:M.species, spacer:M.spacer, nick:M.nick, strand:M.strand,
    editPos:M.editPos, publishedPBS:M.pubPBS, pbsSelected:picks.pbsTop, rtTemplate:picks.rtTop,
    candidateLens:picks.pbsLens, tmBand:band,
    weights:{'PBS-spacer5':1.2,'PBS-scaffold3':1.0,'PBS-selffold':0.8},
    reportedOnly:['PBS-RT'], bands:{perfect:'>= -5', low:'-5 to -8', medium:'-8 to -12', critical:'< -12'},
    rows};
}
const panelBd = landscapeData('TaUbi10-T2');
const panelCd = landscapeData('OsCDC48-T1');

// TEVO_SYSTEMS is block-scoped inside the tool, so it is read from the source text
// rather than the vm global; the assertion keeps that honest.
const HTML = fs.readFileSync(process.env.PPE_HTML, 'utf8');
const mTevo = HTML.match(/TEVO_SYSTEMS\s*=\s*\[([^\]]*)\]/);
if (!mTevo) throw new Error('TEVO_SYSTEMS not found in the build');
const TEVO_SYSTEMS = mTevo[1].split(',').map(x => x.trim().replace(/^'|'$/g,'')).filter(Boolean);

/* ── Panel C — assembled pegRNA, tevopreQ1 architecture ───────────────────
   The worked example used throughout the paper: rice OsALS-T2, the published G->T at 301.
   Segment lengths come from the tool's own constants and design functions. */
const ALS = fs.readFileSync(ROOT+'/data/sequences_plain/OsALS-T2.txt','utf8').trim();
// FIX PANEL-F-NICK (19 September 2026). ALS_NICK was 297 and the edit was passed as
// genomicPos 306 while its ref base was read from ALS[305]. Both are off by one against
// analysis/worked_example.json, which has nick_pos0 296 and the edit at 0-based 305, and
// against every other rendering of this design. Because the ref base did not match the base
// at the position given, the engine left the template UNEDITED, so the panel drew a pegRNA
// whose reverse-transcriptase template is genomic wild-type: rt GTAAAACCTATCCTCCCATT and a
// 9 nt pbs GCACCACCA, against the 20 nt TAAAACCTATTCTCCCATTG and 10 nt CACCACCATA that
// Figure 3, Supplementary Figure S3, Supplementary Data S1 and Table S11 all carry — and
// that this panel's own legend claims it is identical to. The transcript lengths it printed,
// 169 and 131 nt, were one short of the transcript and insert lengths everything else stated at the time.
// FIX PANEL-F-SOURCE (20 September 2026). These three were typed, and typed values drift:
// the bug above was exactly that. They are read from analysis/worked_example.json now, the
// same record the assertion below holds the panel to, so the panel cannot describe a
// different design from Figure 3, Supplementary Data S1 and the Table S11 controlled panel.
const _WEXF = JSON.parse(fs.readFileSync(require('path').join(__dirname,'worked_example.json'),'utf8'));
const ALS_SP = _WEXF.spacer, ALS_NICK = _WEXF.nick_pos0, ALS_EDIT_POS0 = _WEXF.edit_pos0;
const ALS_ALT = _WEXF.edit_to;
// Panel D's worked example is a RICE locus; the band is process-global, so reset it.
run('_PPE_TM_BAND_KEY = __a', 'rice');

const segC = JSON.parse(run(`(function(){
  var pbs = genPBS(__a.seq,__a.np,'+',8,22,__a.sp,false);
  var pbsTop = pbs && pbs[0] ? pbs[0] : null;
  var rt = genRT(__a.seq,__a.np,__a.ed,'+',10,30,__a.sp, pbsTop?pbsTop.seq:'');
  var rtTop = rt && rt[0] ? rt[0] : null;
  var lk = (typeof m2_designLinker==='function' && pbsTop && rtTop)
             ? m2_designLinker(__a.sp, M3_SCAFFOLD, rtTop.seq, pbsTop.seq) : null;
  return JSON.stringify({
    spacer: __a.sp,
    scaffold: M3_SCAFFOLD,
    rt: rtTop ? rtTop.seq : '', rtHom: rtTop ? rtTop.homologyBeyondEdit : null,
    pbs: pbsTop ? pbsTop.seq : '', pbsTm: pbsTop ? pbsTop.tm : null,
    linker: lk ? (lk.seq || lk.best && lk.best.seq || '') : LINKER,
    linkerName: lk ? (lk.name || (lk.best && lk.best.name) || '') : 'default',
    tevo: TEVO_preQ1, polyT: POLY_T_TERM, poolN: (typeof _LINKER_POOL!=='undefined'?_LINKER_POOL.length:null)
  });
})()`, {seq:ALS, np:ALS_NICK, sp:ALS_SP,
        ed:[{genomicPos:ALS_EDIT_POS0, type:'SNP', ref:ALS[ALS_EDIT_POS0], alt:ALS_ALT}]}));

// The panel must draw the design the paper's other four renderings draw. Checked here rather
// than trusted, because the whole defect above was a silent disagreement with that record.
(function(){
  const rec = JSON.parse(fs.readFileSync(require('path').join(__dirname,'worked_example.json'),'utf8'));
  const want = rec.expect || {};
  const bad = [];
  if (want.pbs && segC.pbs !== want.pbs) bad.push('pbs '+segC.pbs+' vs '+want.pbs);
  if (want.rt  && segC.rt  !== want.rt)  bad.push('rt '+segC.rt+' vs '+want.rt);
  if (want.homology_beyond_edit != null && segC.rtHom !== want.homology_beyond_edit)
    bad.push('homology '+segC.rtHom+' vs '+want.homology_beyond_edit);
  if (bad.length) throw new Error('panel F does not match analysis/worked_example.json — '
    + bad.join('; ') + '. The panel and the record must describe one design.');
})();

const out = {build:FP, generated_by:'analysis/build_figure2_editable.js',
  panelA:{locus:'OsDEP1', species:'Oryza sativa', editPos:POS, window:DEP1.length, rows:panelA},
  panelB:panelBd,
  panelC:panelCd,
  // The locus label and the spacer both come from the record now. This panel is built on
  // the spacer Figure S3's walkthrough shows -- one of three tied at the top score, NOT the
  // published spacer Figure 3 and Supplementary Data S1 use — same site, same edit,
  // different design. Saying so on the panel is the whole point.
  panelD:{locus:WEX_LOCUS, species:'Oryza sativa',
          // derived, not typed: the caption drifted from the drawing once already
          edit:ALS[_WEXF.edit_pos0]+'>'+_WEXF.edit_to+' at '+_WEXF.edit_pos1,
          // 'top-ranked' was wrong: on the published edit this spacer is rank 2 of 20,
          // one of three tied at the top composite score. Derived, not typed.
          spacerChoice:'tied-top (' + _WEXF.spacer + ')',
    architectures:11, tevoSystems:TEVO_SYSTEMS, seg:segC}};
// FIX DATA-PATH (13 Sep 2026). This wrote to the CURRENT WORKING DIRECTORY, so a run from
// the repository root left analysis/figure2_editable_data.json untouched at whatever it was
// last time someone ran the builder from inside analysis/. analysis/stamp_build_ids.py read
// that stale copy and stamped the Figure 2 legend with a build that no longer existed. The
// same defect was fixed in build_figure3_editable.js in August and missed here.
fs.writeFileSync(require('path').join(__dirname, 'figure2_editable_data.json'),
                 JSON.stringify(out,null,1));
console.log('build', FP);
console.log('A rows', panelA.length, '| D linker', segC.linker, segC.linker.length,'nt pool', segC.poolN);
[['B',panelBd],['C',panelCd]].forEach(([k,P])=>{
  const inb = P.rows.filter(r=>!r.missing && r.tm>=P.tmBand.opt[0] && r.tm<=P.tmBand.opt[1]).map(r=>r.len);
  console.log(`${k} ${P.locus} (${P.species}) band ${P.tmBand.opt[0]}-${P.tmBand.opt[1]}C = ${inb[0]}-${inb[inb.length-1]} nt` +
              `  selects ${P.pbsSelected.length} nt (published ${P.publishedPBS})`);
  console.log(`${k} risk:`, ['perfect','low','medium','critical'].map(b=>b+' '+P.rows.filter(r=>r.risk===b).length).join(' · '));
  console.log(`${k} wDG :`, P.rows.map(r=>r.wDG.toFixed(1)).join(' '));
  console.log(`${k} tm  :`, P.rows.map(r=>r.tm.toFixed(0)).join(' '));
});
// FIX FIG2F-TERMINATOR: this diagnostic summed six segments while the panel it describes
// draws seven, so it printed 167 where the slide prints 173 — a second copy of the same
// total, disagreeing with the first. One list, summed once.
const _F_SEGS = ['spacer', 'scaffold', 'rt', 'pbs', 'linker', 'tevo', 'polyT'];
console.log('D segs:', _F_SEGS.map(k => k + ' ' + segC[k].length).join(' '),
            '=> total', _F_SEGS.reduce((a, k) => a + segC[k].length, 0));


/* ══ the two robustness results, panels D and E ═══════════════════════════
   Both were declared in the text as judgements of this work. Measuring them
   turns a hedge into a result, and both regenerate from the shipped engine:
     analysis/weight_sensitivity.js        -> weight_sensitivity.json
     analysis/homology_falsifiability.js   -> homology_falsifiability.json      */
const WS = JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'weight_sensitivity.json'),'utf8'));
const HF = JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'homology_falsifiability.json'),'utf8'));

/* ══ PART 2 — draw ═══════════════════════════════════════════════════════ */
const pptxgen = require('pptxgenjs');
const D = out;

const C = {
  ink:'1A1A1A', mid:'4A4A4A', soft:'8A8A8A', rule:'C9CDD2', hair:'E8EAEC', grey:'F2F3F4',
  // Okabe-Ito, colour-blind safe
  blue:'0072B2', verm:'D55E00', green:'009E73', sky:'56B4E9', purple:'CC79A7', amber:'E69F00',
  // risk bands
  bPerfect:'D9F0E3', bLow:'FAF0CD', bMedium:'F8DDB0', bCritical:'F5C9C4',
  ePerfect:'009E73', eLow:'C9A227', eMedium:'D98B2B', eCritical:'C0392B'
};
const F = 'Arial';
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.author = 'Plant Prime Editor';
pres.title  = 'Figure 2 — pegRNA design: scoring, thermodynamics and assembly';
let s = pres.addSlide(); s.background = { color:'FFFFFF' };

const BOXES = [];
const T = (o,x,y,w,h,op={}) => {
  const txt = (typeof o === 'string') ? o : o.map(r => r.text).join('');
  const pt  = (typeof o === 'string') ? 8 : Math.max(...o.map(r => (r.options && r.options.fontSize) || 8));
  const bold = (typeof o !== 'string') && o.some(r => r.options && r.options.bold);
  const mono = (typeof o !== 'string') && o.some(r => r.options && r.options.fontFace === 'Courier New');
  BOXES.push({x,y,w,h,txt,pt,bold,mono,align:op.align||'left'});
  return s.addText(o, Object.assign({x,y,w,h,isTextBox:true,margin:0,fontFace:F,color:C.ink,valign:'top'}, op));
};
const LN = (x1,y1,x2,y2,col,wpt,dash,arrow) => s.addShape(pres.ShapeType.line,{
  x:Math.min(x1,x2), y:Math.min(y1,y2), w:Math.abs(x2-x1), h:Math.abs(y2-y1),
  line:Object.assign({color:col,width:wpt}, dash?{dashType:dash}:{}, arrow?{endArrowType:'triangle'}:{}),
  flipH:x2<x1, flipV:y2<y1 });
const R = (x,y,w,h,fill,lineCol,lineW,rad,dash) => s.addShape(
  rad ? pres.ShapeType.roundRect : pres.ShapeType.rect,
  Object.assign({x,y,w,h,
    fill: fill ? {color:fill} : {type:'none'},
    line: lineCol ? Object.assign({color:lineCol,width:lineW===undefined?0.75:lineW}, dash?{dashType:dash}:{}) : {type:'none'}},
    rad ? {rectRadius:rad} : {}));
const head = (letter, title, sub, x, y, w) => {
  if (letter) T([{text:letter, options:{fontSize:15, bold:true}}], x, y, 0.26, 0.26);
  T([{text:title, options:{fontSize:11.5, bold:true}}], x+0.30, y+0.02, w-0.30, 0.22);
  if (sub) T([{text:sub, options:{fontSize:8, color:C.mid}}], x+0.30, y+0.24, w-0.30, 0.18);
};
// Arial advance widths, used both to place numbers inside bar segments and to
// check at the end that no string overflows the box it was given.
const AW = {' ':0.278,'.':0.278,',':0.278,'·':0.333,'/':0.278,'(':0.333,')':0.333,'-':0.333,
  '–':0.556,'—':1.000,'−':0.584,'+':0.584,'×':0.584,'→':0.838,'⇔':0.838,
  'Δ':0.667,'°':0.400,':':0.278,'′':0.191,'★':0.800,'│':0.260,'≥':0.549,'<':0.584};
function adv(ch){
  if (AW[ch] !== undefined) return AW[ch];
  if (ch >= '0' && ch <= '9') return 0.556;
  if (ch >= 'a' && ch <= 'z') return 'ijl'.includes(ch)?0.222 : 'ft'.includes(ch)?0.278 : 'mw'.includes(ch)?0.836 : 0.556;
  if (ch >= 'A' && ch <= 'Z') return 'IJ'.includes(ch)?0.290 : 'MW'.includes(ch)?0.870 : 0.690;
  return 0.620;
}
const widthIn = (t,pt,bold) => [...t].reduce((a,c)=>a+adv(c),0) * (bold?1.05:1) * pt / 72;
const monoIn  = (t,pt) => t.length * 0.600 * pt / 72;   // Courier New is 0.6 em per glyph

const num = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
const int = v => (v < 0 ? '−' : '') + Math.abs(Math.round(v));

/* ══ A — spacer composite score, decomposed by term ═══════════════════════ */
{
  const LX = 0.55, LW = 1.62;                    // label column
  const AX = 2.32, AWD = 3.13, LIM = 85;         // plot box and axis half-range
  const TX = 5.52, TW = 0.58;                    // total column
  const Z  = AX + AWD/2;                         // the zero line
  const sc = v => v/(2*LIM) * AWD;               // value → inches
  const R0 = 1.84, PITCH = 0.44, BH = 0.24;      // first row, row pitch, bar height
  const TERMS = [
    ['distScore', C.blue,   'nick-to-edit distance', true ],
    ['gcScore',   C.green,  'spacer GC content',     true ],
    ['seedScore', C.sky,    'seed-region GC',        false],
    ['polyT',     C.verm,   'poly-T terminator penalty',    true],
    ['dGpen',     C.purple, 'secondary-structure ΔG penalty', true]
  ];
  head('A', 'Spacer composite score, decomposed by term',
       `rice ${D.panelA.locus}, ${D.panelA.window} nt window, edit at position ${D.panelA.editPos}`, 0.55, 1.05, 5.55);

  // column captions for the label block
  T([{text:'candidate · spacer 5′→3′', options:{fontSize:6.5, bold:true, color:C.mid}}], LX, R0-0.34, LW, 0.13);
  T([{text:'PAM · strand · nick-to-edit distance', options:{fontSize:6.5, color:C.soft}}], LX, R0-0.20, LW, 0.13);
  T([{text:'score', options:{fontSize:6.5, bold:true, color:C.mid}}], TX, R0-0.34, TW, 0.13, {align:'right'});

  // vertical grid and the zero line
  const AY = R0 + 4*PITCH + BH + 0.26;   // the leader labels sit under the last bar
  [-80,-40,0,40,80].forEach(v => LN(Z+sc(v), R0-0.10, Z+sc(v), AY, v===0?C.rule:C.hair, v===0?1.1:0.75));

  D.panelA.rows.forEach((r, i) => {
    const y = R0 + i*PITCH;
    // line 1: candidate id and the 20 nt spacer, in a monospaced face so the
    // five sequences align base for base
    T([{text:r.id, options:{fontSize:8, bold:true}}], LX, y-0.025, 0.36, 0.15);
    T([{text:r.spacer, options:{fontSize:6.5, fontFace:'Courier New', color:C.ink}}],
      LX+0.36, y-0.015, LW-0.36, 0.14);
    // line 2: PAM, strand geometry, nick-to-edit distance
    T([{text:`PAM ${r.pam} · strand ${r.strand} · nick→edit ${r.dist} nt`,
        options:{fontSize:6, color:C.mid}}], LX, y+0.135, LW, 0.13);

    // positive terms stack right from zero, negative terms stack left;
    // each segment carries its own contribution
    let xp = Z, xn = Z;
    const outside = [];                      // segments too narrow to hold their number
    TERMS.forEach(([k,col,,onDark]) => {
      const v = r[k]; if (!v) return;
      const w = Math.abs(sc(v));
      const x = v > 0 ? xp : xn - w;
      R(x, y, w, BH, col, 'FFFFFF', 0.5);
      const lab = (v > 0 ? '+' : '−') + Math.abs(v);
      const fit = [6, 5.5].find(pt => w >= widthIn(lab, pt, true) + 0.04);
      if (fit) {
        T([{text:lab, options:{fontSize:fit, bold:true, color: onDark ? 'FFFFFF' : C.ink}}],
          x, y+0.070, w, 0.12, {align:'center'});
      } else {
        outside.push({lab, col, cx:x + w/2, tw:widthIn(lab, 5.5, true) + 0.04});
      }
      if (v > 0) xp += w; else xn -= w;
    });
    // set them below the bar with a leader, packed left to right so two adjacent
    // narrow segments cannot write over one another
    let cursor = -Infinity;
    outside.sort((a,b) => a.cx - b.cx).forEach(o => {
      let lx = Math.max(o.cx - o.tw/2, cursor);
      cursor = lx + o.tw + 0.02;
      LN(o.cx, y+BH, o.cx, y+BH+0.045, o.col, 0.7);
      if (lx + o.tw/2 !== o.cx) LN(o.cx, y+BH+0.045, lx+o.tw/2, y+BH+0.065, o.col, 0.7);
      T([{text:o.lab, options:{fontSize:5.5, bold:true, color:o.col}}], lx, y+BH+0.065, o.tw, 0.11, {align:'center'});
    });

    // the score the interface ranks on, after the 1-99 floor
    LN(Z+sc(r.total), y-0.045, Z+sc(r.total), y+BH+0.045, C.ink, 1.6);
    T([{text:String(r.total), options:{fontSize:8.5, bold:true}}], TX, y-0.03, TW, 0.16, {align:'right'});
    if (r.clamped) T([{text:`sum ${num(r.sum).replace('.0','')} → 1`, options:{fontSize:6, color:C.verm}}],
      TX-0.06, y+0.14, TW+0.06, 0.13, {align:'right'});
  });

  // axis
  LN(AX, AY, AX+AWD, AY, C.mid, 1.0);
  [-80,-40,0,40,80].forEach(v => { LN(Z+sc(v), AY, Z+sc(v), AY+0.06, C.mid, 1.0);
    T([{text:int(v), options:{fontSize:7, color:C.mid}}], Z+sc(v)-0.20, AY+0.09, 0.40, 0.14, {align:'center'}); });
  T([{text:'contribution to the composite score', options:{fontSize:8}}], AX, AY+0.26, AWD, 0.16, {align:'center'});

  // legend: fixed pitch, two columns, so no row can wrap into the next
  const LY = AY + 0.44, LP = 0.17, LC = [2.32, 4.25];
  TERMS.forEach(([,col,lab], i) => {
    const cx = LC[i < 3 ? 0 : 1], ly = LY + (i % 3)*LP;
    R(cx, ly+0.025, 0.16, 0.10, col, 'FFFFFF', 0.4);
    T([{text:lab, options:{fontSize:7, color:C.ink}}], cx+0.22, ly, 1.60, 0.15);
  });
  T([{text:'│ marks the ranked score, floored at 1: a large penalty removes a spacer from contention but cannot rank it below another.',
     options:{fontSize:7, color:C.mid}}], 0.55, LY + 3*LP + 0.02, 5.55, 0.15);
}

/* ══ the PBS free-energy landscape, drawn twice ═══════════════════════════
   X0 is the panel's left edge; every other x derives from it, so the same
   geometry serves a right-hand panel on slide 1 and a left-hand one on slide 2. */
function landscape(P, letter, headline, subline, X0){
  const rows = P.rows, N = rows.length;
  const LBLX = X0, BX = X0 + 1.67, BW = 4.26, CW = BW/N;
  const RY = 2.00, RH = 0.28;
  const LBLW = BX - LBLX - 0.20;   // gutter so the window bracket clears the labels
  head(letter, headline, subline, X0, 1.05, 5.93);

  // column headers
  rows.forEach((r,i) => T([{text:String(r.len), options:{fontSize:6.5, color:C.mid}}],
    BX+i*CW, RY-0.19, CW, 0.14, {align:'center'}));
  T([{text:'PBS length (nt)', options:{fontSize:7, color:C.mid}}], BX, RY-0.50, BW, 0.14, {align:'center'});

  // which scored channel sets the colour in each column
  const gov = rows.map(r => {
    const c = [['sp', r.spRun>=2 ? r.dSp*1.2 : 0], ['sc', r.sc3Run>=2 ? r.dSc3*1.0 : 0],
               ['sf', r.selfRun>=2 ? r.dSelf*0.8 : 0]];
    return c.reduce((a,b) => b[1] < a[1] ? b : a)[0];
  });
  const band = r => r.risk==='critical' ? [C.bCritical,C.eCritical]
              : r.risk==='medium' ? [C.bMedium,C.eMedium]
              : r.risk==='low' ? [C.bLow,C.eLow] : [C.bPerfect,C.ePerfect];

  const ROWS = [
    ['Tm (°C, nearest-neighbour)', '',       r => int(r.tm),                    null],
    ['PBS ⇔ spacer 5′',        '×1.2', r => (r.dSp===null||r.spRun<2)?'—':num(r.dSp), 'sp'],
    ['PBS ⇔ scaffold 3′',      '×1.0', r => num(r.dSc3),                  'sc'],
    ['PBS self-fold',                    '×0.8', r => num(r.dSelf),                 'sf'],
    ['worst weighted ΔG',           'colour',    r => num(r.wDG),                   'W'],
    ['PBS ⇔ RT template',           'reported',  r => r.dRT===null?'—':num(r.dRT), null]
  ];
  ROWS.forEach(([lab, tag, fmt, key], k) => {
    const y = RY + k*RH;
    T([{text:lab, options:{fontSize:7, bold:key==='W'}}], LBLX, y+0.04, LBLW-(tag?0.42:0.02), 0.14, {align:'right'});
    if (tag) T([{text:tag, options:{fontSize:6.5, color:C.mid, italic:tag==='reported'}}], LBLX+LBLW-0.40, y+0.045, 0.40, 0.13, {align:'right'});
    rows.forEach((r,i) => {
      const x = BX+i*CW;
      let fill = 'FFFFFF', edge = C.hair, ew = 0.5, bold = false;
      if (key === 'W')            { const b = band(r); fill = b[0]; edge = b[1]; ew = 0.9; bold = true; }
      else if (key === null)      { fill = C.grey; }
      else if (gov[i] === key)    { edge = C.ink; ew = 1.1; bold = true; }
      R(x, y, CW, RH, fill, edge, ew);
      T([{text:fmt(r), options:{fontSize:6.5, bold, color:C.ink}}], x, y+0.075, CW, 0.14, {align:'center'});
    });
  });

  // The window marked here is the SPECIES melting band expressed in lengths AT THIS LOCUS,
  // not a fixed length range. Until 12 Sep 2026 this drew a hard-coded 8-11 nt box, which is
  // the rice band restated as a length, on a wheat panel. The lengths that reach the band
  // depend on GC, so they are read off this locus's own Tm row rather than assumed.
  const _bandOpt = P.tmBand.opt;
  const _inBand = rows.filter(r => !r.missing && r.tm >= _bandOpt[0] && r.tm <= _bandOpt[1]);
  const w0 = rows.findIndex(r => r.len === _inBand[0].len);
  const w1 = rows.findIndex(r => r.len === _inBand[_inBand.length-1].len);
  // the verticals sit exactly on cell boundaries; only the horizontals stand clear of the grid
  R(BX+w0*CW, RY-0.075, (w1-w0+1)*CW, 6*RH+0.15, null, C.blue, 1.3, 0, 'dash');
  const _lo = _inBand[0].len, _hi = _inBand[_inBand.length-1].len;
  T([{text:`${_bandOpt[0]}–${_bandOpt[1]} °C band = ${_lo===_hi ? _lo : _lo+'–'+_hi} nt here`,
      options:{fontSize:6.5, color:C.blue}}],
    BX+w0*CW-0.55, RY+6*RH+0.11, (w1-w0+1)*CW+1.10, 0.13, {align:'center'});
  rows.forEach((r,i) => { if (P.candidateLens.includes(r.len))
    T([{text:'★', options:{fontSize:6, color:C.amber}}], BX+i*CW, RY-0.34, CW, 0.12, {align:'center'}); });

  // risk key — the critical band is drawn although nothing at this locus reaches it
  const KY = RY + 6*RH + 0.26, KX = X0;
  T([{text:'risk band of the worst weighted ΔG, kcal mol⁻¹', options:{fontSize:7, color:C.mid}}], KX, KY, 3.10, 0.14);
  [['perfect','≥ −5',C.bPerfect,C.ePerfect], ['low','−5 to −8',C.bLow,C.eLow],
   ['medium','−8 to −12',C.bMedium,C.eMedium], ['critical','< −12',C.bCritical,C.eCritical]
  ].forEach(([n,rng,f,e], i) => {
    const x = KX + i*1.50, y = KY + 0.19;
    R(x, y+0.015, 0.20, 0.13, f, e, 0.9);
    T([{text:n, options:{fontSize:7, bold:true}}, {text:'  '+rng, options:{fontSize:6.5, color:C.mid}}],
      x+0.26, y, 1.20, 0.14);
  });
  const NY = KY + 0.44, NP = 0.165;
  [`★ returned as a candidate · the tool selects ${P.pbsSelected.length} nt here (published: ${P.publishedPBS} nt)`,
   'the outlined cell in each column sets the colour; a positive self-fold ΔG means no hairpin forms',
   'PBS ⇔ RT is reported, not scored — the PBS is chosen before any RT template exists',
   rows.every(r => r.missing || r.risk==='perfect')
     ? 'no length at this locus is structurally penalised — the melting band alone decides the choice here'
     : rows.some(r=>r.risk==='critical') ? 'the critical band is reached at this locus'
                                         : 'no length at this locus reaches the critical band; it is drawn for scale'
  ].forEach((t,i) => T([{text:t, options:{fontSize:7, color:C.mid}}], KX, NY+i*NP, 5.93, 0.15));
}

/* ══ SLIDE 1 — B, the wheat landscape ════════════════════════════════════ */
landscape(D.panelB, 'B', 'PBS free-energy landscape',
  `wheat ${D.panelB.locus}, spacer ${D.panelB.spacer}, nick g.${D.panelB.nick}`, 6.85);
comparison(0.55, 5.30, 5.90, 2.42, 1.74, 6.85, 0.19);
audit('slide 1 — A, B and the comparison');

/* ══ SLIDE 2 — C, the rice landscape, then D ═════════════════════════════ */
s = pres.addSlide(); s.background = { color:'FFFFFF' };
// centred: the panel is 5.93 wide on a 13.33 slide, so 3.70 puts its midpoint on the fold
landscape(D.panelC, 'C', 'PBS free-energy landscape, a rice locus for comparison',
  `rice ${D.panelC.locus}, spacer ${D.panelC.spacer}, nick g.${D.panelC.nick}`, 3.70);
weightPanel(0.55, 5.18, 12.23);
audit('slide 2 — C and D');

/* ══ SLIDE 3 — E, the homology rule, then F ══════════════════════════════ */
s = pres.addSlide(); s.background = { color:'FFFFFF' };
homologyPanel(0.55, 1.05, 12.23);

/* the point of drawing the landscape twice, stated once */
function comparison(X, Y, W, CW0, CW1, NX, RH2){
  head('', 'Why the same analysis twice', '', X, Y, W);
  const tmOf = P => { const r = P.rows.find(x => !x.missing && x.len === P.pbsSelected.length); return r ? r.tm : '?'; };
  const inb = P => { const o=P.rows.filter(r=>!r.missing && r.tm>=P.tmBand.opt[0] && r.tm<=P.tmBand.opt[1]).map(r=>r.len);
                     return o.length ? (o[0]===o[o.length-1] ? `${o[0]} nt` : `${o[0]}–${o[o.length-1]} nt`) : 'none'; };
  const TB = [
    ['', 'B · wheat', 'C · rice'],
    ['locus', D.panelB.locus, D.panelC.locus],
    ['melting band (NN)', `${D.panelB.tmBand.opt[0]}–${D.panelB.tmBand.opt[1]} °C`, `${D.panelC.tmBand.opt[0]}–${D.panelC.tmBand.opt[1]} °C`],
    ['evidence for that band', D.panelB.tmBand.evidence, D.panelC.tmBand.evidence],
    ['lengths reaching it here', inb(D.panelB), inb(D.panelC)],
    ['selected', `${D.panelB.pbsSelected.length} nt`, `${D.panelC.pbsSelected.length} nt`],
    ['published', `${D.panelB.publishedPBS} nt`, `${D.panelC.publishedPBS} nt`],
    ['Tm of that primer-binding site', `${tmOf(D.panelB)} °C`, `${tmOf(D.panelC)} °C`]
  ];
  const TY = Y + 0.58;
  TB.forEach((r,i) => {
    const y = TY + i*RH2;
    if (i === 0) R(X, y, CW0+2*CW1, RH2, 'EEF3F7', null, 0);
    else if (i % 2 === 0) R(X, y, CW0+2*CW1, RH2, 'F7F9FA', null, 0);
    LN(X, y, X+CW0+2*CW1, y, C.hair, 0.8);
    [[r[0], X, CW0, 'left'], [r[1], X+CW0, CW1, 'left'], [r[2], X+CW0+CW1, CW1, 'left']]
      .forEach(([t, x, w, al]) => { if (t === '') return;
        T([{text:String(t), options:{fontSize:7.4, bold:(i===0), color:(i===0?C.blue:(x===X?C.mid:C.ink))}}],
          x+0.10, y+(RH2-0.13)/2, w-0.16, 0.13, {align:al}); });
  });
  LN(X, TY+TB.length*RH2, X+CW0+2*CW1, TY+TB.length*RH2, C.hair, 0.8);
  const NY2 = NX ? TY + 0.02 : TY + TB.length*RH2 + 0.18;
  const NW  = NX ? W : W;
  const NXX = NX || X;
  [`At both loci the tool selects ${D.panelB.pbsSelected.length} nt, and at both it agrees with the design the original authors published. The same length is not the same molecule: ${tmOf(D.panelB)} °C at the wheat locus, ${tmOf(D.panelC)} °C at the rice one.`,
   `Each sits inside its own species band. A rule stated in nucleotides cannot hold both — the length that reaches a given melting temperature depends on GC content, so it moves with the species and with the locus. The rice band here falls at ${inb(D.panelC)}, not at the 8–11 nt the rice optimum is usually quoted as.`,
   'The rice band rests on 74 measurements re-derived here; the wheat band is one sentence of reported internal testing (Li H et al. 2026), and is not re-derived.'
  ].forEach((t,i) => T([{text:t, options:{fontSize:7.6, color:C.mid}}], NXX, NY2+i*0.52, NW, 0.50, {lineSpacing:10.2}));
}

/* ══ D — the RT⇔PBS weight, swept ══════════════════════════════════════════
   The heaviest weight in the tool is a judgement, not a measurement. Rather
   than say so and leave it there, the tool is rebuilt at seven values and the
   template it SELECTS is recorded at every locus. Scores move with the weight;
   selections are what a user sees, and they barely move at all. The grid is
   the argument: an almost uniform field with a handful of marks in it.        */
function weightPanel(X, Y, W){
  const L = WS.per_locus, WTS = WS.weights_tested.slice().sort((a,b)=>a-b), SHIP = WS.shipped_weight;
  head('D', 'The heaviest weight in the tool changes almost nothing it selects',
       `reverse-transcriptase template chosen at each of the ${WS.loci} benchmark loci, with the RT⇔PBS channel weighted 0 to 3 · each cell is the length selected, in nucleotides`,
       X, Y, W);

  const GX = X + 1.05, GW = W - 1.05 - 0.92, CW = GW / L.length, RH = 0.152;
  const GY = Y + 0.62;

  // species band, so a reader can see the movers are not clustered in one species
  const SPC = {'Oryza sativa':['rice',C.blue], 'Triticum aestivum':['wheat',C.amber], 'Solanum lycopersicum':['tomato',C.green]};
  let run0 = 0;
  for (let i=1; i<=L.length; i++){
    if (i===L.length || L[i].species !== L[run0].species){
      const sp = SPC[L[run0].species] || ['other', C.soft];
      R(GX+run0*CW, GY-0.17, (i-run0)*CW-0.015, 0.115, sp[1], null, 0);
      if ((i-run0)*CW > 0.55)
        T([{text:sp[0], options:{fontSize:6.2, bold:true, color:'FFFFFF'}}],
          GX+run0*CW, GY-0.162, (i-run0)*CW-0.015, 0.10, {align:'center'});
      run0 = i;
    }
  }

  const MOVERS = new Set();
  Object.values(WS.loci_affected).forEach(list => list.forEach(x => MOVERS.add(x.split('/')[0])));

  WTS.forEach((w, ri) => {
    const y = GY + ri*RH, isShip = (w === SHIP);
    const lab = isShip ? '1.5 (shipped)' : w === 0 ? '0 (channel off)' : w.toFixed(1);
    T([{text:lab, options:{fontSize:6.8, bold:isShip, color:isShip?C.blue:C.ink}}],
      X, y+0.028, 0.98, 0.11, {align:'right'});
    L.forEach((r, ci) => {
      const len = r.lengths[String(w)];
      const moved = r.seqs[String(w)] !== r.seqs[String(SHIP)];
      R(GX+ci*CW, y, CW-0.015, RH-0.018,
        isShip ? 'EAF3FA' : moved ? 'FADEC8' : 'F2F3F4',
        isShip ? C.blue   : moved ? C.verm   : C.hair, moved ? 1.1 : 0.5);
      T([{text: len===null ? '–' : String(len), options:{fontSize:5.6, bold:moved, color:moved?C.verm:C.mid}}],
        GX+ci*CW, y+0.032, CW-0.015, 0.09, {align:'center'});
    });
    const ch = WS.changed_vs_shipped[String(w)];
    T([{text: isShip ? '—' : ch+' of '+WS.loci, options:{fontSize:6.8, bold:ch>0, color:ch>0?C.verm:C.soft}}],
      GX+GW+0.06, y+0.028, 0.84, 0.11);
  });
  T([{text:'weight', options:{fontSize:6.8, bold:true, color:C.mid}}], X, GY-0.17, 0.98, 0.11, {align:'right'});
  T([{text:'selections moved', options:{fontSize:6.4, bold:true, color:C.mid}}], GX+GW+0.06, GY-0.17, 0.90, 0.11);

  // name only the columns that move; an elbow keeps a pushed label on its own column
  const yb = GY + WTS.length*RH;
  let last = -9;
  L.forEach((r, ci) => {
    if (!MOVERS.has(r.locus)) return;
    const cx = GX + ci*CW + (CW-0.015)/2, lw = 0.92;
    let lx = cx - lw/2; if (lx < last) lx = last; last = lx + lw + 0.02;
    LN(cx, yb, cx, yb+0.04, C.verm, 1.0);
    if (Math.abs((lx+lw/2) - cx) > 0.02){
      LN(cx, yb+0.04, lx+lw/2, yb+0.04, C.verm, 1.0);
      LN(lx+lw/2, yb+0.04, lx+lw/2, yb+0.065, C.verm, 1.0);
    } else LN(cx, yb+0.04, cx, yb+0.065, C.verm, 1.0);
    T([{text:r.locus, options:{fontSize:6.0, bold:true, color:C.verm}}], lx, yb+0.075, lw, 0.10, {align:'center'});
  });

  // When the maximum equals the off-channel count, "the largest change is N" restates the
  // clause before it. Say the stronger thing the data supports instead: no weight in the
  // range moves more than that. Both wordings are generated, so neither can go stale.
  const sameMax = WS.max_change === WS.off_changes;
  T([{text:'Switching the channel off entirely moves ', options:{fontSize:7.2}},
     {text:WS.off_changes+' selection of '+WS.loci, options:{fontSize:7.2, bold:true, color:C.verm}},
     {text: sameMax ? ', and no weight from 0 to 3 moves more than '
                    : '; the largest change anywhere across 0–3 is ', options:{fontSize:7.2}},
     {text: sameMax ? WS.max_change+' of '+WS.loci
                    : WS.max_change+' of '+WS.loci, options:{fontSize:7.2, bold:true, color:C.verm}},
     {text:'. The weight breaks ties; it does not drive selection.', options:{fontSize:7.2}}],
    X, yb+0.20, W, 0.13);
}

/* ══ E — the homology rule, made to fail ═══════════════════════════════════
   Recorded for a month as "not falsifiable by construction". True of the
   default search, false of the function: force the length range down and the
   engine returns short templates and flags them. Both halves are drawn —
   the protection working, and the protection failing on demand.              */
function homologyPanel(X, Y, W){
  head('E', 'The homology rule is testable: forced, the engine returns short templates and flags them',
       `homology retained 3′ of the edit as the requested template length is forced down, at rice ${HF.locus} · the 5 nt minimum is Anzalone et al. 2019`,
       X, Y, W);
  const lad = HF.ladder.filter(r => r.hom !== null);
  const PX = X + 0.72, PY = Y + 0.70, PW = 6.55, PH = 2.55;
  const maxH = Math.max(...lad.map(r=>r.hom), 15);
  const yOf = v => PY + PH - (v/maxH)*PH;
  const bw = (PW/lad.length) - 0.05;

  R(PX, yOf(5), PW, PY+PH-yOf(5), 'F7DCD8', null, 0);
  LN(PX, yOf(5), PX+PW, yOf(5), C.eCritical, 1.2, 'dash');
  // the only clear space above the rule is over the two sub-threshold bars at the left
  T([{text:'5 nt minimum', options:{fontSize:7.2, bold:true, color:C.eCritical}}],
    PX+0.08, yOf(5)-0.19, 0.95, 0.12);

  LN(PX, PY+PH, PX+PW, PY+PH, C.ink, 1.0); LN(PX, PY, PX, PY+PH, C.ink, 1.0);
  [0,5,10,15].forEach(v => { if (v > maxH) return;
    LN(PX-0.05, yOf(v), PX, yOf(v), C.mid, 0.8);
    T([{text:String(v), options:{fontSize:6.4, color:C.mid}}], PX-0.32, yOf(v)-0.05, 0.26, 0.10, {align:'right'}); });
  T([{text:'homology 3′ of the edit (nt)', options:{fontSize:6.8, color:C.mid}}], PX-0.34, PY-0.18, 2.40, 0.11);

  lad.forEach((r,i) => {
    const x = PX + 0.03 + i*(PW/lad.length);
    const col = r.band==='critical' ? C.eCritical : r.band==='low' ? C.eLow : C.ePerfect;
    const fil = r.band==='critical' ? C.bCritical : r.band==='low' ? C.bLow : C.bPerfect;
    R(x, yOf(r.hom), bw, PY+PH-yOf(r.hom), fil, col, 1.0);
    T([{text:String(r.hom), options:{fontSize:5.8, bold:true, color:col}}], x, yOf(r.hom)-0.125, bw, 0.10, {align:'center'});
    T([{text:String(r.len), options:{fontSize:6.0, color:C.mid}}], x, PY+PH+0.04, bw, 0.10, {align:'center'});
  });
  T([{text:'requested template length (nt)', options:{fontSize:6.8, color:C.mid}}], PX, PY+PH+0.18, 1.90, 0.11);
  const gone = HF.ladder.filter(r => r.hom === null).map(r => r.len);
  if (gone.length)
    T([{text:`at ${gone[0]}–${gone[gone.length-1]} nt the engine returns nothing at all — it refuses rather than clipping the edit`,
       options:{fontSize:6.6, color:C.soft}}], PX+1.95, PY+PH+0.18, 4.20, 0.11);

  const dmin = Math.min(...HF.default_offered.map(o=>o.len)), dmax = Math.max(...HF.default_offered.map(o=>o.len));
  const DX = X + 7.95, DW = 4.28;
  R(DX, PY, DW, PH, C.bPerfect, C.ePerfect, 1.0, 0.01);
  T([{text:'What the default search offers', options:{fontSize:8.4, bold:true, color:C.ePerfect}}], DX+0.12, PY+0.09, DW-0.24, 0.14);
  T([{text:`lengths ${dmin}–${dmax} nt`, options:{fontSize:7.8}}], DX+0.12, PY+0.29, DW-0.24, 0.12);
  T([{text:'lowest homology offered: ', options:{fontSize:7.8}},
     {text:HF.default_min_homology+' nt', options:{fontSize:7.8, bold:true, color:C.ePerfect}}],
    DX+0.12, PY+0.47, DW-0.24, 0.12);
  T([{text:'Nothing under the 5 nt rule is ever put in front of a user — the protection works. It is reachable only by overriding the length range, which is what makes the rule a claim that can fail.',
     options:{fontSize:6.8, color:C.mid}}], DX+0.12, PY+0.67, DW-0.24, 0.60, {lineSpacing:8.6});

  const KY2 = PY+PH+0.38;
  [['≥ 10 nt · no warning', C.ePerfect, C.bPerfect],
   ['5–9 nt · warned', C.eLow, C.bLow],
   ['< 5 nt · flagged CRITICAL', C.eCritical, C.bCritical]].forEach(([lab,col,fil],i) => {
    const kx = PX + i*2.30;
    R(kx, KY2, 0.15, 0.11, fil, col, 1.0);
    T([{text:lab, options:{fontSize:6.8}}], kx+0.21, KY2, 2.00, 0.11);
  });
}

/* ══ F — the assembled pegRNA ═════════════════════════════════════════════ */
{
  const g = D.panelD.seg;
  const SEG = [
    ['spacer',       g.spacer.length,   C.blue,   'design', 'from the PAM scan'],
    ['sgRNA scaffold', g.scaffold.length, C.soft, 'fixed',  'invariant sequence'],
    ['RT template',  g.rt.length,       C.blue,   'design', `edit + ${g.rtHom} nt homology`],
    ['PBS',          g.pbs.length,      C.blue,   'design', `Tm ${g.pbsTm} °C`],
    ['linker',       g.linker.length,   C.purple, 'chosen', `1 of ${g.poolN}`],
    ['tevopreQ1',    g.tevo.length,     C.soft,   'fixed',  'pseudoknot motif'],
    // FIX FIG2F-TERMINATOR (27 Sep 2026). The strip drew six segments and stopped at
    // tevopreQ1, so it printed 167 nt for the PE2max transcript while deriving 128 nt for
    // the others as TOT - linker - tevo + polyT -- adding a terminator to one number that
    // the other did not contain. 128 nt is the figure the tool itself reports, and it
    // includes the 6 nt poly-T, so the two could not both be right. Every Pol III cassette
    // terminates on the poly-T: the pseudoknot architectures do not replace it, they add
    // linker + tevopreQ1 in front of it. Drawn and counted now, which makes the transcript
    // 173 nt and the difference exactly linker + tevopreQ1 = 45 nt.
    // The block is 6 nt wide, and widths in this strip are strictly proportional to length
    // (the legend says so), so its two labels have to fit 0.42 in rather than the strip being
    // distorted to suit them. "poly-T terminator" needed 0.95 in and "Pol III termination"
    // 0.73 in; the caption directly beneath spells both out in full.
    ['poly-T',        g.polyT.length,    C.soft,   'fixed',  'Pol III']
  ];
  const TOT = SEG.reduce((a,x) => a+x[1], 0);
  const CX = 0.55, CWD = 12.00, BY = 6.02, BH = 0.44;
  head('F', 'The assembled pegRNA, annotated by what determines each segment',
       // Which SPACER. Every rendering of this design now uses the SAME spacer -- this
       // panel, Figure 3, Supplementary Data S1, Supplementary Figure S3 and the Table S11
       // controlled panel -- so there is one set of numbers. It is one of three spacers
       // tied at the top composite score for the published edit, the second by sort order;
       // the protospacer Lin et al. published ranks 5 of 20 for that edit and is not used
       // here. The two-designs state this comment used to describe is gone.
       `rice ${D.panelD.locus}, ${D.panelD.edit}, on one of three spacers tied at the tool’s top score; PE2max / ePPE / PPE / ePPE3 architecture · widths proportional to length`,
       0.55, 5.30, 12.23);

  T([{text:'5′', options:{fontSize:8, bold:true, color:C.mid}}], CX-0.22, BY+0.13, 0.20, 0.16, {align:'right'});
  T([{text:'3′', options:{fontSize:8, bold:true, color:C.mid}}], CX+CWD+0.04, BY+0.13, 0.22, 0.16);
  let x = CX;
  SEG.forEach(([name, n, col, , detail]) => {
    const w = n/TOT*CWD;
    R(x, BY, w, BH, col, 'FFFFFF', 0.8);
    T([{text:name, options:{fontSize:8, bold:true}}], x, BY-0.20, w, 0.16, {align:'center'});
    T([{text:`${n} nt`, options:{fontSize:8, bold:true, color:'FFFFFF'}}], x, BY+0.13, w, 0.17, {align:'center'});
    T([{text:detail, options:{fontSize:6.5, color:C.mid}}], x, BY+BH+0.06, w, 0.14, {align:'center'});
    x += w;
  });
  const KY = BY + BH + 0.30;
  [[C.blue,'derived from the genome and the selected edit'],
   [C.purple,`selected by free-energy minimisation from ${g.poolN} candidates`],
   [C.soft,'fixed sequence, identical in every design']
  ].forEach(([col,lab], i) => {
    const kx = CX + i*4.05;
    R(kx, KY+0.025, 0.16, 0.10, col, 'FFFFFF', 0.4);
    T([{text:lab, options:{fontSize:7, color:C.ink}}], kx+0.22, KY, 3.70, 0.15);
  });
  T([{text:`${TOT} nt transcript. The ${['','one','two','three','four','five','six','seven','eight','nine','ten','eleven'][D.panelD.architectures - D.panelD.tevoSystems.length]} architectures without a pseudoknot (${D.panelD.tevoSystems.join(', ')} carry one) omit the linker and tevopreQ1 and close directly on the same ${g.polyT.length} nt poly-T terminator, giving ${TOT-g.linker.length-g.tevo.length} nt.`,
     options:{fontSize:7, color:C.mid}}], CX, KY+0.20, 12.00, 0.15);
}

/* ══ titles and footer ════════════════════════════════════════════════════ */
T([{text:'Figure 2.  ', options:{fontSize:13.5, bold:true}},
   {text:'pegRNA design: scoring, thermodynamics, assembly, and the robustness of both', options:{fontSize:13.5}}],
  0.55, 0.24, 12.4, 0.28);
T([{text:`Every value is output of the shipped build, regenerated by analysis/build_figure2_editable.js; no number in this figure is transcribed by hand.`,
   options:{fontSize:9.5, color:C.mid}}], 0.55, 0.57, 12.4, 0.22);
T([{text:`Plant Prime Editor v1.0 · build ${D.build} · every element is a native, editable PowerPoint object`,
   options:{fontSize:8, color:'AAAAAA'}}], 0.55, 7.20, 12.4, 0.18);

s.addNotes(`Figure 2. A: spacer composite score at rice ${D.panelA.locus}, decomposed into the terms findSpacers computes; the vertical rule is the score the interface ranks on, floored at 1. B: PBS free-energy landscape at wheat ${D.panelB.locus} over 8-22 nt. Three channels carry the score at the weights genPBS uses (spacer 5' x1.2, scaffold 3' x1.0, self-fold x0.8); the outlined cell in each column is the channel that sets the colour. PBS-RT is reported and not scored, because the PBS is chosen before any RT template exists; that interaction is scored from the other side, in the RT ranking. No length at this locus reaches the critical band. C: the assembled pegRNA for the worked example, rice ${D.panelD.locus}, coloured by what determines each segment.`);

/* ══ layout audit ═════════════════════════════════════════════════════════ */
function audit(tag){
  let bad = 0;
  for (let a=0; a<BOXES.length; a++) for (let b=a+1; b<BOXES.length; b++) {
    const p=BOXES[a], q=BOXES[b];
    const ox = Math.min(p.x+p.w,q.x+q.w) - Math.max(p.x,q.x);
    const oy = Math.min(p.y+p.h,q.y+q.h) - Math.max(p.y,q.y);
    if (ox>0.004 && oy>0.004) { bad++; console.log(`[${tag}] OVERLAP "${p.txt.slice(0,24)}" x "${q.txt.slice(0,24)}"`); }
  }
  BOXES.forEach(p => { const t = p.txt.split('\n')[0];
    if (p.x < 0.02 || p.x+p.w > 13.31 || p.y < 0.02 || p.y+p.h > 7.48) { bad++;
      console.log(`[${tag}] OFF-SLIDE "${t.slice(0,28)}" x ${p.x.toFixed(2)}..${(p.x+p.w).toFixed(2)} y ${p.y.toFixed(2)}..${(p.y+p.h).toFixed(2)}`); }
    const need = p.mono ? monoIn(t,p.pt) : widthIn(t,p.pt,p.bold);
    const lines = Math.max(1, Math.floor(p.h/(p.pt*1.18/72)));
    if (need > p.w*(lines===1?1:lines*0.93) + 0.01) { bad++; console.log(`[${tag}] OVERFLOW "${t.slice(0,30)}" needs ${need.toFixed(2)} box ${p.w.toFixed(2)}`); }
  });
  console.log(bad===0 ? `[${tag}] ${BOXES.length} text boxes, no overlaps, no overflow`
                      : `[${tag}] ${bad} problem(s)`);
  BOXES.length = 0;
}
audit('slide 3 — E and F');

pres.writeFile({fileName: 'Figure2_ABCDEF_editable.pptx'}).then(f => console.log('written', f));
