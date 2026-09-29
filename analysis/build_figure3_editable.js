#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — Figure 3, derived and drawn in one pass.

   PART 1 runs the shipped build headlessly and derives every value the figure
   shows; PART 2 draws it as native PowerPoint shapes. Nothing is transcribed.

   PANEL A  the restriction screen, run on two real inserts against the same six
            routes: the unmodified worked-example insert, and the deposit's own
            negative control with a CGTCTC site planted in the RT template
            (analysis/case_studies.js, negativeControls). The route the tool then
            selects is computed with the tool's own rule (FIX PUBLISHED-ROUTE-
            DEFAULT, 13 Aug 2026) rather than by taking the first route left
            standing — for a BsmBI acceptor those differ. Right: smartRecommend's
            ranking for PE2 in rice, over the library.

   PANEL B  the primer set for the same worked example. Each primer is drawn
            where it actually anneals: the annealing footprint is located in the
            insert by sequence, not assumed, and the 5' tail is the balance of
            its length laid out in the primer's own direction. The rows are
            banded by what each primer is FOR, and that grouping is read out of
            the tool's own role and purpose strings rather than from the primer
            number — P4 is emitted alongside P1-P3 but the build disowns it for
            Golden Gate ("NOT for BsaI/BsmBI Golden Gate cloning ... use ONLY in
            a 3-fragment Gibson or In-Fusion assembly"), and P5/P6 are colony
            verification primers, not cloning primers.

   Both parts end in a layout audit: every text box is checked pairwise for
   collision and every string against the width of the box it was given.

   USAGE  node analysis/build_figure3_editable.js
          writes figure3_editable_data.json and Figure3_AB_editable.pptx
   ═══════════════════════════════════════════════════════════════════════════ */
process.env.PPE_HTML = process.env.PPE_HTML || (require('path').resolve(__dirname, '..') + '/plant_prime_editor_v1.0.html');
const ROOT = require('path').resolve(__dirname, '..');
const vm=require('vm'), fs=require('fs');
const {ctx,q}=require(ROOT+'/tests/probe.js');
const run=(e,a)=>{ctx.__a=a;return vm.runInContext(e,ctx,{timeout:30000});};
const FP=q('(typeof PPE_BUILD!=="undefined"&&PPE_BUILD.fingerprint)||"unknown"');

const _WEX0 = JSON.parse(fs.readFileSync(ROOT+'/analysis/worked_example.json','utf8'));
const VEC_ID=_WEX0.vector_id, PE=_WEX0.pe_system;

/* ── the worked example, DERIVED (13 Sep 2026, corrected 13 Sep 2026) ───────
   The spacer, reverse-transcriptase template and primer-binding site were four
   hard-coded literals here, frozen at whatever the tool produced when the figure
   was first drawn. The engine has changed twice since — genPBS now ranks on the
   species melting band, and the edit encoding was repaired — so the figure could
   state a design the shipped tool no longer produces, and nothing would notice.
   They are computed now.

   The inputs come from analysis/worked_example.json, which is the single copy every
   script drawing this design reads, so the figure cannot state a different template
   length from Supplementary Data S1, Table S11 and Supplementary Figure S3. An earlier
   version computed them here instead and drifted from those three. */
const WEX = _WEX0;
const LOCUS = WEX.locus;
const WE = (function(){
  const g = fs.readFileSync(ROOT+'/'+WEX.sequence_file,'utf8')
              .split('\n').filter(l => !l.startsWith('>')).join('')
              .replace(/\s+/g,'').toUpperCase();
  const from = g.charAt(WEX.edit_pos0), to = WEX.edit_to;
  const ed = [{genomicPos:WEX.edit_pos0, type:WEX.edit_type, ref:from, alt:to}];
  const d = JSON.parse(run(`JSON.stringify((function(){
    var a = __a;
    var pbs = genPBS(a.g, a.nk, a.st, ${WEX.pbs_min}, ${WEX.pbs_max}, a.sp, false);
    var rt  = genRT(a.g, a.nk, a.ed, a.st, ${WEX.rt_min}, ${WEX.rt_max}, a.sp, pbs.length?pbs[0].seq:'');
    if (!pbs.length || !rt.length) throw new Error('no PBS or RT at the worked-example locus');
    return { sp:a.sp, rt:rt[0].seq, pbs:pbs[0].seq, pbsTm:pbs[0].tm,
             rtHom:rt[0].homologyBeyondEdit, nick:a.nk, strand:a.st,
             edit:a.from_+'>'+a.to_+' at '+a.ep };
  })())`, { g:g, nk:WEX.nick_pos0, st:WEX.strand, sp:WEX.spacer, ep:WEX.edit_pos1,
            ed:ed, from_:from, to_:to }));
  d.ngArgs = { g:g, nk:WEX.nick_pos0, st:WEX.strand, ed:ed };
  // the figure may not state a design the canonical record disagrees with
  const E = WEX.expect, bad = [];
  if (d.pbs !== E.pbs)        bad.push('PBS '+d.pbs+' vs '+E.pbs);
  if (d.rt  !== E.rt)         bad.push('RT '+d.rt+' vs '+E.rt);
  if (d.rtHom !== E.homology_beyond_edit) bad.push('homology '+d.rtHom+' vs '+E.homology_beyond_edit);
  if (bad.length) throw new Error('worked example does not match analysis/worked_example.json: '
    + bad.join('; ') + ' — reconcile the two before rebuilding the figure');
  return d;
})();
const SP = WE.sp, RT = WE.rt, PBS = WE.pbs;
// the PE3 nicking sgRNA at the same locus, also derived rather than pasted
const NICK = (function(){
  try {
    const n = JSON.parse(run(`JSON.stringify(genNickSgRNA(__a.g, __a.nk, __a.st, __a.ed, 'NGG', 20, 'PE3'))`,
      WE.ngArgs));
    return n.length ? n[0].spacer : WE.sp;
  } catch (e) { return WE.sp; }
})();
console.log('  worked example derived: spacer ' + SP.length + ' nt, RT ' + RT.length +
            ' nt, PBS ' + PBS.length + ' nt (Tm ' + WE.pbsTm + ' °C, homology ' + WE.rtHom + ' nt)');

/* ── the vector library, and the ranking the tool returns ─────────────────── */
const VECTORS = JSON.parse(q(`JSON.stringify(VECTORS.map(v=>({
  id:v.id, name:v.name, plant:v.plant, enzyme:v.enzyme, addgene:v.addgene||null,
  pe:v.peSystems, promoter:v.pegRNA_promoter||null })))`));
const ranking = JSON.parse(q(`JSON.stringify(smartRecommend('${PE}','monocot','Oryza sativa','balanced'))`));

/* ── the restriction screen, on three real inserts ────────────────────────── */
const scan = (ins) => run(`(function(){
  var v=VECTORS.find(x=>x.id===__a.vid);
  return JSON.parse(JSON.stringify(m3_checkInternalRE(__a.ins, v)));
})()`, {vid:VEC_ID, ins});

const insert = run(`__a.sp + M3_SCAFFOLD + __a.rt + __a.pbs + POLY_T_TERM`, {sp:SP,rt:RT,pbs:PBS});
const scafLen = q('M3_SCAFFOLD.length'), polyTLen = q('POLY_T_TERM.length');
// the deposit's own negative control: a cloning site planted in the RT template
const plantedRT = 'TTCCGTCTCGAGCTCAGCTGACC';
const plantedIns = run(`'GACCAGCTCGGCAAGTTCTA' + M3_SCAFFOLD + __a.rt + 'CTGGCTGCAT'`, {rt:plantedRT});

const cases = [
  {label:'worked example', detail:'rice '+LOCUS+' insert, unmodified', ins:insert, hits:scan(insert)},
  {label:'planted control', detail:"CGTCTC planted in the RT template", ins:plantedIns, hits:scan(plantedIns)}
];

/* ── which of the six routes each case leaves open ────────────────────────── */
const VEC = JSON.parse(q(`JSON.stringify((function(){var v=VECTORS.find(x=>x.id===${JSON.stringify(VEC_ID)});
  return {enzyme:v.enzyme, ggNotPublished:!!v.golden_gate_not_published};})())`));
const ROUTES = [
  {id:'gg',   name:VEC.enzyme+' Golden Gate',  enz:VEC.enzyme, chem:'Type IIS'},
  {id:'bsmbi',name:'BsmBI cassette swap',     enz:'BsmBI', chem:'Type IIS'},
  {id:'esp3i',name:'Esp3I (BsmBI isoschizomer)', enz:'Esp3I', chem:'Type IIS'},
  {id:'onestep_gibson', name:'One-step PCR + Gibson', enz:null, chem:'homologous recombination'},
  {id:'gblock', name:'gBlock + Gibson',       enz:null, chem:'homologous recombination'},
  {id:'infusion', name:'In-Fusion HD',        enz:null, chem:'homologous recombination'}
];
cases.forEach(c => {
  const crit = c.hits.filter(h => h.critical).map(h => h.name);
  c.critical = crit;
  const ggBlocked    = crit.length > 0;
  const bsmbiBlocked = c.hits.some(h => h.name === 'BsmBI' || h.seq === 'CGTCTC');
  c.blocked = [];
  if (ggBlocked)    c.blocked.push('gg');
  if (bsmbiBlocked) c.blocked.push('bsmbi', 'esp3i');
  c.blocked = [...new Set(c.blocked)];
  // exactly the rule the tool applies (FIX PUBLISHED-ROUTE-DEFAULT, 13 Aug 2026):
  //   bestId = publishedIsNotGG ? onestep_gibson : ggBlockedFinal ? (bsmbiBlocked ? onestep_gibson : bsmbi) : gg
  c.bestId = VEC.ggNotPublished ? 'onestep_gibson'
           : ggBlocked ? (bsmbiBlocked ? 'onestep_gibson' : 'bsmbi')
           : 'gg';
  c.bestName = ROUTES.find(r => r.id === c.bestId).name;
  c.advisory = c.hits.filter(h => !h.critical).map(h => `${h.name} at ${h.pos}${h.strand||''}`);
});

/* ── the primer set for the worked example, with the tool's own QC ────────── */
vm.runInContext(`
  selectedVec = VECTORS.find(v=>v.id===${JSON.stringify(VEC_ID)});
  plantType='monocot'; targetOrganism='Oryza sativa';
  m2Data = { peSystem:${JSON.stringify(PE)}, spacer:{spacer:${JSON.stringify(SP)}},
             rt:{seq:${JSON.stringify(RT)}}, pbs:{seq:${JSON.stringify(PBS)}},
             selectedNick:{spacer:${JSON.stringify(NICK)},strand:'+'},
             nickSgRNAs:[{spacer:${JSON.stringify(NICK)},strand:'+'}] };
  window._m3EditableSeqs=null; allPrimers.length=0; selectedCloningStrategy='gg';
  runPrimerDesign();
`, ctx);
const primers = JSON.parse(q(`JSON.stringify(allPrimers.filter(p=>/^P[0-9]/.test(p.name)).map(p=>({
  name:p.name, role:p.role, len:(p.seq||'').length, anneal:(p.anneal||'').length,
  tm:p.tm, gc:(p.qc&&p.qc.gc), gcClamp:!!(p.qc&&p.qc.gcClamp),
  selfComp:(p.qc&&p.qc.selfComp&&p.qc.selfComp.risk)||null,
  selfDetail:(p.qc&&p.qc.selfComp&&p.qc.selfComp.detail)||null,
  status:(p.qc&&p.qc.overallStatus)||null, score:(p.qc&&p.qc.score)||null,
  annealSeq:(p.anneal||''), purpose:(p.purpose||''), warnings:(p.qc&&p.qc.warnings)||[] })))`));

/* what each primer is FOR, taken from the tool's own role and purpose strings
   rather than from its number: P4 is emitted alongside P1-P3 but the build's own
   purpose text disowns it for Golden Gate ("NOT for BsaI/BsmBI Golden Gate
   cloning ... Use ONLY in a 3-fragment Gibson or In-Fusion assembly"). */
const GROUPS = {clone:'used in this route', alt:'alternative route only', verify:'colony verification'};
primers.forEach(p => {
  const r = (p.role||'') + ' ' + (p.purpose||'');
  p.group = /verification/i.test(r) ? 'verify'
          : (/\bONLY\b/.test(r) || /3-fragment/i.test(r)) ? 'alt'
          : 'clone';
});

/* where each primer actually anneals: located in the insert, not assumed */
const rcs = t => t.split('').reverse().map(c=>({A:'T',T:'A',G:'C',C:'G'}[c]||c)).join('');
primers.forEach(p => {
  const a = (p.annealSeq||'').toUpperCase().replace(/[^ACGT]/g,'');
  if (!a) { p.site = null; return; }
  let i = insert.indexOf(a);
  if (i >= 0) { p.site = {start:i, end:i+a.length, dir:'+'}; return; }
  i = insert.indexOf(rcs(a));
  p.site = (i >= 0) ? {start:i, end:i+a.length, dir:'−'} : null;   // null = anneals in the vector
});

/* ── the three named, assembly-specific checks ────────────────────────────── */
const named = JSON.parse(q(`(function(){
  var g=function(n){return allPrimers.find(function(p){return p.name.indexOf(n)===0;});};
  var p1=g('P1'), p2=g('P2'), p3=g('P3');
  var het = (typeof m3_heterodimer==='function') ? m3_heterodimer(p1.seq,p3.seq) : null;
  // FIX P3-FOLD-INPUT (13 Sep 2026). This passed the WHOLE P3 primer; the tool passes
  // the 15 nt of scaffold P3's 3' end anneals through. Before m3_simpleHairpinDG was made
  // window-independent the two inputs gave opposite verdicts on the same primer — the
  // figure printed 'low, dG 0.0' while the tool printed 'high'. Same input as the tool now.
  var fold= (typeof m3_p3FoldCheck==='function') ? m3_p3FoldCheck(M3_SCAFFOLD.slice(-15)) : null;
  return JSON.stringify({
    heterodimer: het, p3fold: fold,
    dTm: Math.round(Math.abs(p1.tm-p2.tm)*10)/10,
    p1tm:p1.tm, p2tm:p2.tm, p3tm:p3.tm });
})()`));

/* Scan every benchmark insert, on both strands, for the nine backbone enzymes and the
   three Type IIS cloning enzymes, and report what is actually there. A Type IIS hit is
   flagged separately, because that one CAN close a route. */
function scanBenchmarkInserts(){
  const BKB = [['HindIII','AAGCTT'],['EcoRI','GAATTC'],['BamHI','GGATCC'],['SalI','GTCGAC'],
               ['KpnI','GGTACC'],['XbaI','TCTAGA'],['NcoI','CCATGG'],['SpeI','ACTAGT'],['NheI','GCTAGC']];
  const IIS = [['BsaI','GGTCTC'],['BsmBI','CGTCTC'],['BbsI','GAAGAC']];
  const RCB = {A:'T',T:'A',G:'C',C:'G'};
  const rcs = x => x.split('').reverse().map(c => RCB[c]||c).join('');
  const lines = fs.readFileSync(ROOT + '/data/benchmark_scored.csv','utf8').split('\n').filter(Boolean);
  const split = l => { const o=[]; let c='', q=false;
    for (const ch of l) { if (ch==='"') q=!q; else if (ch===','&&!q) {o.push(c);c='';} else c+=ch; }
    o.push(c); return o; };
  const HD = split(lines[0]), cx = n => HD.indexOf(n);
  const seen = new Set(), found = [];
  let scanned = 0;
  for (const f of lines.slice(1).map(split)) {
    if (!/^OK/.test(f[cx('status')]||'')) continue;
    const L = f[cx('locus')]; if (seen.has(L)) continue; seen.add(L);
    const from = f[cx('edit_from_top')] || f[cx('edit_from')];
    const to   = f[cx('edit_to_top')]   || f[cx('edit_to')];
    let p = +f[cx('edit_pos')] - 1;
    if (f[cx('edit_strand')] === '-' && from.length > 1) p = p - from.length + 1;
    let ins = '';
    try {
      ctx.__scan = { g:f[cx('genomic_seq')], nk:+f[cx('nick_pos')], st:f[cx('spacer_strand')],
                     sp:f[cx('published_spacer')],
                     ed:[{genomicPos:p, type:f[cx('edit_type')], ref:from, alt:to||'-'}] };
      ins = vm.runInContext(`(function(){
        var a = __scan;
        var pbs = genPBS(a.g,a.nk,a.st,8,15,a.sp,false);
        var rt  = genRT(a.g,a.nk,a.ed,a.st,10,30,a.sp,pbs.length?pbs[0].seq:'');
        if(!pbs.length||!rt.length) return '';
        return a.sp + M3_SCAFFOLD + rt[0].seq + pbs[0].seq + POLY_T_TERM;
      })()`, ctx, {timeout:20000});
    } catch (e) { continue; }
    if (!ins) continue;
    scanned++;
    const rev = rcs(ins);
    BKB.forEach(([nm,sq]) => { const i = ins.indexOf(sq);
      if (i >= 0 || rev.indexOf(sq) >= 0) found.push({locus:L, enzyme:nm, pos:i, cloning:false}); });
    IIS.forEach(([nm,sq]) => { const i = ins.indexOf(sq);
      if (i >= 0 || rev.indexOf(sq) >= 0) found.push({locus:L, enzyme:nm, pos:i, cloning:true}); });
  }
  found.scanned = scanned;
  console.log('  RE screen: ' + scanned + ' inserts scanned, ' + found.length + ' site(s): ' +
    found.map(x => x.enzyme + ' at ' + x.locus).join(', '));
  return found;
}

const out = {build:FP, generated_by:'analysis/build_figure3_editable.js',
  panelA:{
    locus:LOCUS, pe:PE, vector:VEC_ID,
    vectorName:(VECTORS.find(v=>v.id===VEC_ID)||{}).name,
    enzyme:VEC.enzyme, ggNotPublished:VEC.ggNotPublished,
    insertLen:insert.length, scafLen, polyTLen,
    backboneEnzymes:['HindIII','EcoRI','BamHI','SalI','KpnI','XbaI','NcoI','SpeI','NheI'],
    routes:ROUTES, cases,
    ranking: ranking.map(id => VECTORS.find(v=>v.id===id)),
    library:{total:VECTORS.length,
      published:VECTORS.filter(v=>v.addgene).length,
      inHouse:VECTORS.filter(v=>!v.addgene).length,
      dicot:VECTORS.filter(v=>v.plant==='dicot').length,
      monocot:VECTORS.filter(v=>v.plant==='monocot').length},
    // COMPUTED, not asserted (13 Sep 2026). This was a hard-coded literal naming BamHI at
    // OsAAT and NcoI at SlCENH3, and the legend quoted it as a scan result. It was stale:
    // scanning every benchmark insert through the shipped engine finds NcoI at OsEPSPS-T2
    // rather than SlCENH3, and two sites the literal omitted entirely. The primer-binding
    // site lengths moved when genPBS began ranking on the species melting band, which
    // changes the insert and therefore what the screen finds — exactly the reason a figure
    // must not carry a remembered result.
    naturalAdvisory: scanBenchmarkInserts()
  },
  panelB:{locus:LOCUS, pe:PE, vector:VEC_ID,
    segments:[['spacer',SP.length],['sgRNA scaffold',scafLen],['RT template',RT.length],
              ['PBS',PBS.length],['poly-T',polyTLen]],
    primers, named, groups:GROUPS}};
fs.writeFileSync(require('path').join(__dirname,'figure3_editable_data.json'), JSON.stringify(out,null,1));
console.log('build', FP);
console.log('library', JSON.stringify(out.panelA.library));
console.log('ranking', ranking.join(' > '));
cases.forEach(c=>console.log('case', c.label, '| hits', c.hits.length, '| critical', JSON.stringify(c.critical),
  '| blocked', JSON.stringify(c.blocked), '| default ->', c.bestId, '('+c.bestName+')'));
console.log('primers', primers.map(p=>`${p.name} L${p.len} a${p.anneal} Tm${p.tm} GC${p.gc} ${p.status} [${p.group}] site=${p.site?p.site.start+'-'+p.site.end+p.site.dir:'vector'}`).join('\n         '));
console.log('named', JSON.stringify(named));


/* ══ PART 2 — draw ═══════════════════════════════════════════════════════ */
const pptxgen = require('pptxgenjs');
const D = out;

const C = {
  ink:'1A1A1A', mid:'4A4A4A', soft:'8A8A8A', rule:'C9CDD2', hair:'E8EAEC', grey:'F4F5F6',
  blue:'0072B2', verm:'D55E00', green:'009E73', sky:'56B4E9', purple:'CC79A7', amber:'E69F00',
  okF:'D9F0E3', okE:'009E73', warnF:'F8DDB0', warnE:'D98B2B', badF:'F5C9C4', badE:'C0392B',
  infoF:'E3EEF6', infoE:'0072B2'
};
const F = 'Arial';
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.author = 'Plant Prime Editor';
pres.title  = 'Figure 3 — Vector selection, conflict detection and primer construction';
const s = pres.addSlide(); s.background = { color:'FFFFFF' };

const BOXES = [];
const T = (o,x,y,w,h,op={}) => {
  const txt = (typeof o === 'string') ? o : o.map(r => r.text).join('');
  const pt  = (typeof o === 'string') ? 8 : Math.max(...o.map(r => (r.options && r.options.fontSize) || 8));
  const bold = (typeof o !== 'string') && o.some(r => r.options && r.options.bold);
  const mono = (typeof o !== 'string') && o.some(r => r.options && r.options.fontFace === 'Courier New');
  BOXES.push({x,y,w,h,txt,pt,bold,mono});
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
const ARROW = (x,y,w,h,fill,flip) => s.addShape(pres.ShapeType.rightArrow,
  {x,y,w,h,fill:{color:fill},line:{width:0},flipH:!!flip});
const head = (letter,title,sub,x,y,w) => {
  T([{text:letter, options:{fontSize:15, bold:true}}], x, y, 0.26, 0.26);
  T([{text:title, options:{fontSize:11.5, bold:true}}], x+0.30, y+0.02, w-0.30, 0.22);
  if (sub) T([{text:sub, options:{fontSize:8, color:C.mid}}], x+0.30, y+0.24, w-0.30, 0.18);
};
const AW = {' ':0.278,'.':0.278,',':0.278,'·':0.333,'/':0.278,'(':0.333,')':0.333,'-':0.333,"'":0.191,
  '–':0.556,'—':1.000,'−':0.584,'+':0.584,'×':0.584,'→':0.838,'⇔':0.838,'✓':0.700,'✗':0.700,'▶':0.700,'◀':0.700,
  'Δ':0.667,'°':0.400,':':0.278,'′':0.191,'’':0.191,'★':0.800,'│':0.260,'≥':0.549,'≈':0.549,'<':0.584,'%':0.889,'#':0.556,
  '⁻':0.300,'¹':0.333};
function adv(ch){
  if (AW[ch] !== undefined) return AW[ch];
  if (ch >= '0' && ch <= '9') return 0.556;
  if (ch >= 'a' && ch <= 'z') return 'ijl'.includes(ch)?0.222 : 'ft'.includes(ch)?0.278 : 'mw'.includes(ch)?0.836 : 0.556;
  if (ch >= 'A' && ch <= 'Z') return 'IJ'.includes(ch)?0.290 : 'MW'.includes(ch)?0.870 : 0.690;
  return 0.620;
}
const widthIn = (t,pt,bold) => [...t].reduce((a,c)=>a+adv(c),0) * (bold?1.05:1) * pt / 72;
const monoIn  = (t,pt) => t.length * 0.600 * pt / 72;

const LCOL = 0.55, LW = 5.75, RCOL = 6.85, RW = 12.78 - 6.85, FULL = 12.23;

/* ══ A — restriction conflict scan and vector ranking ═════════════════════ */
const A = D.panelA;
head('A', 'A restriction-conflict scan chooses the assembly chemistry, and the vector ranking follows it',
     `insert scanned on both strands with full IUPAC degeneracy for the vector's own Type IIS enzyme and for ${A.backboneEnzymes.length} backbone enzymes`,
     LCOL, 1.00, FULL);

/* ── A left: two real inserts against the same six routes ───────────────── */
{
  const CW = 1.86, CH = 0.20, GAPX = 0.045, GAPY = 0.03;
  T([{text:'six selectable routes across five chemistries — only the three Type IIS routes can be closed by a site inside the insert',
     options:{fontSize:6.5, color:C.mid}}], LCOL, 1.56, LW, 0.12);
  const CASE_Y = [1.76, 2.84];
  A.cases.forEach((c, ci) => {
    const y = CASE_Y[ci], crit = c.critical.length;
    T([{text:c.label, options:{fontSize:8, bold:true}},
       {text:'   '+c.detail, options:{fontSize:7, color:C.mid}}], LCOL, y, LW, 0.14);
    R(LCOL, y+0.185, 0.60, 0.155, crit ? C.badF : C.okF, crit ? C.badE : C.okE, 0.8, 0.03);
    T([{text: crit ? 'conflict' : 'clear', options:{fontSize:6.5, bold:true}}], LCOL, y+0.215, 0.60, 0.12, {align:'center'});
    const hit = crit
      ? `${c.hits.length} internal site — ${c.critical.join(', ')}, the vector's own enzyme`
      : `no internal site for any of the ${A.backboneEnzymes.length + 1} enzymes screened`;
    T([{text:hit, options:{fontSize:7, color:C.mid}}], LCOL+0.68, y+0.205, LW-0.68, 0.13);
    A.routes.forEach((r, i) => {
      const x = LCOL + (i%3)*(CW+GAPX), yy = y + 0.40 + Math.floor(i/3)*(CH+GAPY);
      const off = c.blocked.includes(r.id);
      R(x, yy, CW, CH, off ? C.grey : C.okF, off ? C.rule : C.okE, off ? 0.6 : 0.9, 0.04);
      T([{text:(off?'✗  ':'✓  ')+r.name, options:{fontSize:6.5, bold:!off, color: off ? C.soft : C.ink}}],
        x+0.06, yy+0.042, CW-0.12, 0.12);
    });
    // the route the tool itself selects, not the first one left standing
    T([{text:'the tool selects → ', options:{fontSize:7, color:C.mid}},
       {text: c.bestName, options:{fontSize:7, bold:true}},
       {text: crit ? '   — both Type IIS swaps share that site, so the route leaves Type IIS'
                   : '   — the vector\u2019s own enzyme, not BsaI by default',
        options:{fontSize:6.5, color:C.mid}}],
      LCOL, y + 0.40 + 2*(CH+GAPY) + 0.04, LW, 0.13);
  });
  // grouped by enzyme, because two rows of the same gene are not two findings
  const _adv = A.naturalAdvisory || [];
  const _grp = a => { const m = {}; a.forEach(n => (m[n.enzyme] = m[n.enzyme] || new Set()).add(n.locus));
    return Object.entries(m).map(([e, s]) => e + ' at ' + [...s].join(' and ')).join(', '); };
  const _bk = _adv.filter(n => !n.cloning), _cl = _adv.filter(n => n.cloning);
  // FIX BBSI-SCOPE (13 Sep 2026). A Type IIS site closes the route that USES that enzyme,
  // not every route: an internal BbsI site blocks a BbsI-based assembly and leaves the
  // BsaI, BsmBI, Esp3I and homology-arm routes untouched. 'That alone would close a route'
  // read as though any one cloning-enzyme site shut the assembly down.
  const _clEnz = [...new Set(_cl.map(n => n.enzyme))];
  T([{text:'Backbone sites are advisory: across the benchmark the screen finds '
      + (_bk.length ? _grp(_bk) + ', none a cloning enzyme' : 'no backbone site')
      + (_cl.length ? ' — and ' + _grp(_cl) + ', which is one: it blocks a '
                    + _clEnz.join('- or ') + '-based route and leaves the rest open.' : '.'),
     options:{fontSize:6.0, color:C.mid}}], LCOL, 3.87, LW, 0.28, {lineSpacing:7.8});
}

/* ── A right: the ranking the tool actually returns ─────────────────────── */
{
  const rows = A.ranking, RY = 1.92, RH = 0.235;
  const CX  = [0.02, 0.42, 3.30, 3.96].map(d => RCOL + d);
  const CWd = [0.34, 2.82, 0.60, 1.86];
  const ALG = ['left','left','left','center'];
  T([{text:`the ranking returned for ${A.pe} · rice · monocot`, options:{fontSize:8, bold:true}}],
    RCOL, 1.56, RW, 0.14);
  T([{text:`${rows.length} of the ${A.library.monocot} monocot vectors are compatible with ${A.pe}; routes broken by a conflict are filtered out before ranking`,
     options:{fontSize:6.5, color:C.mid}}], RCOL, 1.72, RW, 0.12);
  ['#','vector','enzyme','availability'].forEach((h,i) =>
    T([{text:h, options:{fontSize:6.5, bold:true, color:C.mid}}], CX[i], RY, CWd[i], 0.12, {align:ALG[i]}));
  LN(RCOL, RY+0.15, 12.78, RY+0.15, C.rule, 0.9);
  rows.forEach((v,i) => { if (i % 2 === 0) R(RCOL, RY+0.18+i*RH, RW, RH, C.grey, null, 0); });
  rows.forEach((v,i) => {
    const y = RY + 0.21 + i*RH;
    T([{text:String(i+1), options:{fontSize:7.5, bold:i===0}}], CX[0], y+0.005, CWd[0], 0.125);
    T([{text:v.name, options:{fontSize:7.5, bold:i===0}}], CX[1], y-0.005, CWd[1], 0.125);
    T([{text:v.id, options:{fontSize:6, color:C.soft, fontFace:'Courier New'}}], CX[1], y+0.125, CWd[1], 0.105);
    T([{text:v.enzyme, options:{fontSize:7}}], CX[2], y+0.005, CWd[2], 0.125);
    const av = v.addgene ? 'Addgene #'+v.addgene : 'in-house derived';
    R(CX[3], y+0.015, CWd[3], 0.155, v.addgene ? C.infoF : C.warnF, v.addgene ? C.infoE : C.warnE, 0.7, 0.03);
    T([{text:av, options:{fontSize:6.5, bold:!v.addgene}}], CX[3], y+0.045, CWd[3], 0.12, {align:'center'});
  });
  const FY = RY + 0.21 + rows.length*RH + 0.06;
  LN(RCOL, FY, 12.78, FY, C.rule, 0.9);
  // FIX ADDGENE-SCOPE (13 Sep 2026). This read '12 deposited at Addgene', which is wider
  // than Table S6 supports: pHEE401E's #71287 is the base CRISPR backbone, not a deposit of
  // the prime-editing derivative profiled here. Eleven of the fifteen are obtainable from
  // Addgene as prime-editing constructs; the twelfth carries an identifier for its parent.
  // That count and its caveat are stated in full in the Figure 3 legend.
  T([{text:`Full library: ${A.library.total} plant binary vectors — ${A.library.published} entries with Addgene identifiers and ${A.library.inHouse} derived in house; ${A.library.dicot} dicot and ${A.library.monocot} monocot. An identifier is not always a deposit of the profiled construct: pHEE401E's is the base backbone.`,
     options:{fontSize:6.5, color:C.mid}}], RCOL, FY+0.06, RW, 0.24, {lineSpacing:8.5});
}

/* ══ B — overlap-extension primers ════════════════════════════════════════ */
const B = D.panelB;
head('B', 'Overlap-extension primers, with the quality control the tool reports for each',
     // Which SPACER, on the panel itself. Every panel drawing this site uses the SAME
     // spacer — Figure 2 panel F, Figure S3, Supplementary Data S1 and the Table S11
     // controlled panel — so the paper states one design rather than two. It is one of
     // three tied at the top composite score for the published edit, not the single
     // highest-ranked candidate.
     `worked example: ${B.locus}, ${B.pe} in ${B.vector}, on one of three spacers tied at the tool's top score — every value below is what the shipped build emits`,
     LCOL, 4.20, FULL);

/* ── B left: where each primer anneals, banded by what each is for ─────── */
const GC = {clone:C.blue, alt:C.amber, verify:C.green};
{
  const total = B.segments.reduce((a,x) => a+x[1], 0);
  const MX = LCOL + 0.90, MW = 4.30, MY = 4.76, MH = 0.24;
  const px = nt => MX + nt/total*MW;
  T([{text:'insert', options:{fontSize:7, bold:true, color:C.mid}}], LCOL, MY+0.055, 0.30, 0.13, {align:'right'});
  const SEGC = [C.blue, C.soft, C.blue, C.sky, C.mid];
  let acc = 0;
  const outLab = [];
  B.segments.forEach(([name,n], i) => {
    const x = px(acc), w = n/total*MW;
    R(x, MY, w, MH, SEGC[i], 'FFFFFF', 0.7);
    const lab = `${name} ${n}`;
    if (widthIn(lab, 6, true) + 0.06 <= w)
      T([{text:lab, options:{fontSize:6, bold:true, color:'FFFFFF'}}], x, MY+0.055, w, 0.12, {align:'center'});
    else outLab.push({lab, col:SEGC[i], cx:x+w/2, tw:widthIn(lab, 6, false) + 0.05});
    acc += n;
  });
  let lcur = -Infinity;
  outLab.forEach(o => {
    const lx = Math.max(o.cx - o.tw/2, lcur); lcur = lx + o.tw + 0.03;
    LN(o.cx, MY+MH, o.cx, MY+MH+0.05, o.col, 0.7);
    if (Math.abs(lx + o.tw/2 - o.cx) > 0.002) LN(o.cx, MY+MH+0.05, lx+o.tw/2, MY+MH+0.075, o.col, 0.7);
    T([{text:o.lab, options:{fontSize:6, color:o.col}}], lx, MY+MH+0.075, o.tw, 0.12, {align:'center'});
  });
  T([{text:`${total} nt`, options:{fontSize:6.5, color:C.mid}}], MX+MW+0.05, MY+0.06, 0.45, 0.12);

  const PY = MY + MH + 0.30, PH = 0.115, PP = 0.17;
  // a coloured rail beside each run of primers that share a purpose
  let gi = 0;
  while (gi < B.primers.length) {
    let gj = gi; while (gj+1 < B.primers.length && B.primers[gj+1].group === B.primers[gi].group) gj++;
    R(0.86, PY + gi*PP, 0.05, (gj-gi+1)*PP - 0.06, GC[B.primers[gi].group], null, 0);
    gi = gj + 1;
  }
  B.primers.forEach((p, i) => {
    const y = PY + i*PP;
    T([{text:p.name.split('_')[0], options:{fontSize:7, bold:true, color:GC[p.group]}}], LCOL, y-0.015, 0.28, 0.13, {align:'right'});
    if (p.site) {
      const fwd = p.site.dir === '+';
      const aX = px(p.site.start), aW = px(p.site.end) - px(p.site.start);
      const tW = (p.len - p.anneal)/total*MW;
      const tX = fwd ? aX - tW : aX + aW;
      const lo = Math.max(MX - 0.50, tX), hi = Math.min(MX + MW + 0.50, tX + tW);
      if (hi > lo) R(lo, y+0.015, hi-lo, PH-0.03, C.hair, C.rule, 0.5);
      ARROW(aX, y, aW, PH, GC[p.group], !fwd);
    } else {
      R(MX-0.44, y+0.015, 0.38, PH-0.03, C.grey, C.rule, 0.5);
      R(MX+MW+0.06, y+0.015, 0.38, PH-0.03, C.grey, C.rule, 0.5);
    }
  });
  const NY = PY + B.primers.length*PP + 0.06;
  T([{text:'Solid = annealing footprint (5′→3′); pale = the 5′ tail. Only P1 + P3 build the product this route ligates — P1 and P2 make the step-1 amplicon, P3 adds the RT template, the PBS and the enzyme site. P5 and P6 anneal in the vector.',
     options:{fontSize:6.5, color:C.mid}}], LCOL, NY, LW, 0.24, {lineSpacing:8.5});

  // the three named checks, moved here so the QC table can be banded by purpose
  const KY = NY + 0.43;
  const n = B.named;
  const CH2 = [
    ['P1 : P3 heterodimer', String(n.heterodimer && n.heterodimer.risk), !!(n.heterodimer && n.heterodimer.risk === 'low')],
    // The value shown is the stem, not a free energy. m3_simpleHairpinDG sums increments
    // (3 kcal/mol per G:C, 2 per A:T, flat 4.5 loop penalty) and is not a nearest-neighbour
    // calculation; and where it finds no stem it has no energy to report at all. The stem
    // is what it measures, so the stem is what the panel states.
    ['P3 scaffold-annealing fold',
     n.p3fold.stem ? `${n.p3fold.stem} bp stem, ${n.p3fold.loop} nt loop · the scaffold's own`
                   : 'no stem ≥ 3 bp in the overlap',
     false],
    ['P1 / P2 Tm mismatch', `ΔTm ${n.dTm} °C · sets the step-1 anneal`, false]
  ];
  const CW2 = (LW - 2*0.05)/3;
  CH2.forEach(([lab, val, ok], i) => {
    const x = LCOL + i*(CW2+0.05);
    R(x, KY, CW2, 0.30, ok ? C.okF : C.warnF, ok ? C.okE : C.warnE, 0.8, 0.04);
    T([{text:lab, options:{fontSize:6.5, bold:true}}], x+0.06, KY+0.04, CW2-0.12, 0.12);
    T([{text:val, options:{fontSize:6.5, color: ok ? C.mid : C.warnE}}], x+0.06, KY+0.165, CW2-0.12, 0.12);
  });
  T([{text:'three failure modes specific to this assembly, checked by name — the fold is a fixed property of the scaffold, not of this target', options:{fontSize:6.5, bold:true, color:C.mid}}],
    LCOL, KY-0.15, LW, 0.12);
}

/* ── B right: per-primer QC, banded by what each primer is for ──────────── */
{
  const RY = 4.80, RH = 0.205, GH = 0.15;
  const HDR = ['primer','role','len','anneal','Tm °C','GC %','3′ clamp','hairpin','QC'];
  const CX  = [0.10, 0.72, 2.44, 2.80, 3.30, 3.80, 4.26, 4.88, 5.44].map(d => RCOL + d);
  const CWd = [0.58, 1.68, 0.32, 0.44, 0.46, 0.42, 0.58, 0.54, 0.48];
  const ALG = ['left','left','right','right','right','right','center','center','center'];
  HDR.forEach((h,i) => T([{text:h, options:{fontSize:6.5, bold:true, color:C.mid}}], CX[i], RY, CWd[i], 0.12, {align:ALG[i]}));
  LN(RCOL, RY+0.15, 12.78, RY+0.15, C.rule, 0.9);
  const ROLE = {P1:'tail + spacer → scaffold 5′',
                P2:'scaffold 3′, reverse',
                P3:'RT + PBS tail → scaffold 3′',
                P4:'forward overlap into the RT region',
                P5:'reads in from the vector, forward',
                P6:'reads in from the vector, reverse'};
  // lay the rows out group by group, each group introduced by its own label
  const plan = []; let y = RY + 0.20, last = null;
  B.primers.forEach(p => {
    if (p.group !== last) { plan.push({label:p.group, y}); y += GH; last = p.group; }
    plan.push({p, y}); y += RH;
  });
  plan.filter(e => e.p).forEach((e,i) => { if (i % 2 === 0) R(RCOL, e.y-0.025, RW, RH, C.grey, null, 0); });
  plan.forEach(e => {
    if (e.label) {
      R(RCOL+0.02, e.y+0.035, 0.09, 0.09, GC[e.label], null, 0);
      T([{text:B.groups[e.label], options:{fontSize:6.5, bold:true, color:GC[e.label], charSpacing:0.5}}],
        RCOL+0.16, e.y+0.02, 3.0, 0.12);
      return;
    }
    const p = e.p, k = p.name.split('_')[0];
    const st = p.status === 'pass' ? [C.okF,C.okE,'pass'] : p.status === 'warn' ? [C.warnF,C.warnE,'warn'] : [C.infoF,C.infoE,'info'];
    R(RCOL+0.02, e.y+0.02, 0.05, 0.15, GC[p.group], null, 0);
    [k, ROLE[k]||'', String(p.len), String(p.anneal), String(p.tm), String(p.gc),
     p.gcClamp?'✓':'✗', p.selfComp||'—'].forEach((t,j) =>
      T([{text:t, options:{fontSize:6.5, bold:j===0,
        color:(j===0) ? GC[p.group] : (j===6 && !p.gcClamp) ? C.verm : (j===7 && p.selfComp === 'moderate') ? C.warnE : C.ink}}],
        CX[j], e.y+0.035, CWd[j], 0.12, {align:ALG[j]}));
    R(CX[8], e.y+0.012, CWd[8], 0.15, st[0], st[1], 0.7, 0.03);
    T([{text:st[2], options:{fontSize:6.5, bold:true}}], CX[8], e.y+0.04, CWd[8], 0.12, {align:'center'});
  });
  T([{text:'P4 is not part of the route shown. The build\u2019s own note on it reads: “NOT for BsaI/BsmBI Golden Gate cloning — P4 has no RE recognition site or vector arm … use ONLY in a 3-fragment Gibson or In-Fusion assembly.”',
     options:{fontSize:6.5, color:C.mid}}], RCOL, y + 0.04, RW, 0.24, {lineSpacing:8.5});
}

/* ══ titles and footer ════════════════════════════════════════════════════ */
T([{text:'Figure 3.  ', options:{fontSize:13.5, bold:true}},
   {text:'Vector selection, conflict detection and primer construction', options:{fontSize:13.5}}],
  0.55, 0.24, 12.4, 0.28);
T([{text:'Every value is output of the shipped build, regenerated by analysis/build_figure3_editable.js; no number in this figure is transcribed by hand.',
   options:{fontSize:9.5, color:C.mid}}], 0.55, 0.57, 12.4, 0.22);
T([{text:`Plant Prime Editor v1.0 · build ${D.build} · every element is a native, editable PowerPoint object`,
   options:{fontSize:8, color:'AAAAAA'}}], 0.55, 7.20, 12.4, 0.18);

s.addNotes(`Figure 3. A: the restriction screen scans the assembled insert on both strands, with full IUPAC degeneracy, for the vector's own Type IIS enzyme and for nine backbone enzymes, and closes the routes a conflict would break. Two real inserts are shown: the unmodified worked example, which is clear, and the deposit's own negative control with a CGTCTC site planted in the RT template, which closes the BsmBI and Esp3I routes. Right: the ranking the tool returns for PE2 in rice, over the 15-vector library. B: the primer set for the same worked example, drawn where each primer actually anneals, with the per-primer quality control and the three named assembly-specific checks.`);

/* ══ layout audit ═════════════════════════════════════════════════════════ */
let bad = 0;
for (let a=0; a<BOXES.length; a++) for (let b=a+1; b<BOXES.length; b++) {
  const p=BOXES[a], q2=BOXES[b];
  const ox = Math.min(p.x+p.w,q2.x+q2.w) - Math.max(p.x,q2.x);
  const oy = Math.min(p.y+p.h,q2.y+q2.h) - Math.max(p.y,q2.y);
  if (ox > 0.004 && oy > 0.004) { bad++;
    console.log(`OVERLAP  "${p.txt.slice(0,32)}" x "${q2.txt.slice(0,32)}"  ${ox.toFixed(3)}x${oy.toFixed(3)}`); }
}
BOXES.forEach(p => {
  // a box tall enough for N lines may wrap into them; anything else must fit on one
  const lines = Math.max(1, Math.floor(p.h / (p.pt * 1.18 / 72)));
  const t = p.txt.split('\n')[0];
  const w = p.mono ? monoIn(t,p.pt) : widthIn(t,p.pt,p.bold);
  const allowed = p.w * (lines === 1 ? 1 : lines * 0.93);
  if (w > allowed + 0.004) { bad++;
    console.log(`OVERFLOW "${t.slice(0,46)}"  needs ${w.toFixed(2)}, box ${p.w.toFixed(2)} x ${lines} line(s)`); }
});
console.log(bad===0 ? `layout audit: ${BOXES.length} text boxes, no overlaps, no overflow`
                    : `layout audit: ${bad} problem(s)`);
pres.writeFile({fileName: 'Figure3_AB_editable.pptx'}).then(f => console.log('written', f));
