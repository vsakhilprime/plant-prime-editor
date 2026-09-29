#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — Supplementary Figure S1, derived and drawn in one pass.

   PART 1 runs the shipped build headlessly and derives two real designs — one
   on each strand — so the geometry is shown with sequences a reader can check
   base by base rather than as a schematic. PART 2 draws it.

   The four footprint formulas are the ones genPBS and genRT actually implement:

     + strand   PBS = RC( genomic[nick-L .. nick-1] )        upstream of the nick
                RT  = RC( genomic[nick .. nick+L-1] + edit ) downstream
     - strand   PBS =     genomic[nick+1 .. nick+L]          downstream, no outer RC
                RT  =     genomic[nick-L+1 .. nick] + edit   upstream,  no outer RC

   TWO margins bound the edit, at opposite ends of the template, and the tool
   enforces them separately. The figure shows both, because the previous version
   named only one and named it at the wrong end:

     homologyBeyondEdit  farthest edit -> DISTAL end.  >= 5 nt required,
                         10-15 nt preferred. This is the flap's genomic homology.
     minEditDist         nearest edit -> the NICK (PBS-proximal end of the RT
                         template). Scored best at 5-10 nt, warned below 5.

     node analysis/build_figureS1_editable.js  ->  FigureS1_editable.pptx
   ═══════════════════════════════════════════════════════════════════════════ */
const pptxgen = require('pptxgenjs'), fs = require('fs'), path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
process.env.PPE_HTML = process.env.PPE_HTML || path.join(ROOT, 'plant_prime_editor_v1.0.html');

/* ══ PART 1 — derive ══════════════════════════════════════════════════════ */
const D = (() => {
  const { ctx } = require(path.join(ROOT, 'tests', 'lib', 'load_tool.js'));
  const run = (e,a) => { ctx.__a = a; return vm.runInContext(e, ctx, {timeout:30000}); };
  const RC = s => s.split('').reverse().map(c => ({A:'T',T:'A',G:'C',C:'G'}[c] || 'N')).join('');
  const comp = s => s.split('').map(c => ({A:'T',T:'A',G:'C',C:'G'}[c] || 'N')).join('');

  // Both cases are read out of data/benchmark_scored.csv — the published spacer, its
  // strand and its nick position — exactly as analysis/case_studies.js reads them, so
  // nothing here is a coordinate typed in by hand. Every index below is 0-based, which
  // is what genPBS and genRT take; the figure prints 1-based positions.
  const splitCsv = l => { const o=[]; let c='', q=false;
    for (let i=0;i<l.length;i++){ const ch=l[i];
      if (ch === '"') { if (q && l[i+1] === '"') { c+='"'; i++; } else q = !q; }
      else if (ch === ',' && !q) { o.push(c); c=''; } else c += ch; }
    o.push(c); return o; };
  const rows = (() => {
    const t = fs.readFileSync(path.join(ROOT,'data','benchmark_scored.csv'),'utf8')
                .replace(/^﻿/,'').trim().split(/\r?\n/);
    const h = splitCsv(t[0]);
    return t.slice(1).map(l => { const c = splitCsv(l), o = {}; h.forEach((k,i)=>o[k]=c[i]); return o; });
  })();
  const locus = name => {
    const r = rows.find(r => r.locus === name && r.genomic_seq && r.published_spacer
                          && r.spacer_strand && r.nick_pos);
    if (!r) throw new Error('no benchmark row with a published spacer for ' + name);
    return r;
  };

  // The rice ALS labels are namespaced by source study (analysis/als_sites.json): two
  // different protospacers in that gene were both called OsALS-T2. This is the worked
  // example, Lin 2021's.
  // PUBLISHED EDITS (20 September 2026). Both panels installed a SYNTHETIC test edit five
  // bases into the template, and panel A was OsALS-T2, whose published substitution sits AT
  // the nick — distance 0 — so keeping the locus and taking the published edit would have
  // cost the figure one of the two margins it exists to display. Panel A moves to OsACC-T1
  // instead: a plus-strand published spacer in the same species whose published G to C at
  // g.306 sits five bases into the template, the same geometry the synthetic edit had, so
  // the figure is unchanged in what it teaches and every base in it is now published.
  const CASES = [{letter:'A', locus:'OsACC-T1',   strand:'+', spacer:'TTCCTCGTGCTGGACAAGTG'},
                 {letter:'B', locus:'OsEPSPS-T1', strand:'-', spacer:'GCAGTCACGGCTGCTGTCAA'}];

  return CASES.map(c0 => {
    // The label OsEPSPS-T1 covers two protospacers, so the case pins the one it means.
    const row = rows.find(r => r.locus === c0.locus && r.published_spacer === c0.spacer
                            && r.genomic_seq && r.spacer_strand && r.nick_pos);
    if (!row) throw new Error('no benchmark row for ' + c0.locus + ' / ' + c0.spacer);
    if (row.spacer_strand !== c0.strand)
      throw new Error(c0.locus + ' is on the ' + row.spacer_strand + ' strand, not ' + c0.strand);
    const g = row.genomic_seq.trim().toUpperCase();
    const nick = parseInt(row.nick_pos, 10);
    const spacer = row.published_spacer.trim().toUpperCase();
    // the locus's own PUBLISHED substitution, in top-strand form, taken from the benchmark
    const pub = rows.filter(r => r.published_spacer === c0.spacer && r.edit_type === 'SNP');
    if (!pub.length) throw new Error(c0.locus + ': no published substitution at this spacer');
    const pr = pub[0];
    const editPos = parseInt(pr.edit_pos, 10) - 1;
    const ref = (pr.edit_from_top || pr.edit_from).toUpperCase();
    const alt = (pr.edit_to_top   || pr.edit_to).toUpperCase();
    if (g[editPos] !== ref)
      throw new Error(c0.locus + ': the window does not read ' + ref + ' at ' + (editPos + 1));
    const reach = c0.strand === '+' ? editPos - nick : nick - editPos;
    if (reach < 0)
      throw new Error(c0.locus + ": the published edit is 5' of the nick");
    const c = Object.assign({}, c0, {nick, spacer, editPos, alt});
    const ed = [{genomicPos:editPos, type:'SNP', ref, alt}];
    const o = JSON.parse(run(`(function(){
      var pbs = genPBS(__a.g,__a.n,__a.st,8,17,__a.sp,false); var p = pbs&&pbs[0]?pbs[0]:null;
      var rt  = genRT(__a.g,__a.n,__a.ed,__a.st,10,30,__a.sp, p?p.seq:''); var r = rt&&rt[0]?rt[0]:null;
      return JSON.stringify({
        pbs: p ? {seq:p.seq, len:p.length, tm:p.tm} : null,
        rt:  r ? {seq:r.seq, len:r.length, hom:r.homologyBeyondEdit,
                  editIdx:r.editPositionsInRT} : null});
    })()`, {g, n:c.nick, st:c.strand, sp:c.spacer, ed}));
    if (!o.pbs || !o.rt) throw new Error(c.locus + ': the build returned no design');

    // footprints in + strand coordinates, exactly as the two functions slice them
    const L = o.pbs.len, R = o.rt.len;
    const pbsFoot = c.strand === '+' ? [c.nick - L, c.nick - 1]      : [c.nick + 1, c.nick + L];
    const rtFoot  = c.strand === '+' ? [c.nick, c.nick + R - 1]      : [c.nick - R + 1, c.nick];
    // the derived strings, rebuilt here from the genomic slice so the figure can
    // show the intermediate and the assertion below proves the redraw is faithful
    const pbsSlice = g.slice(pbsFoot[0], pbsFoot[1] + 1);
    const pbsBuilt = c.strand === '+' ? RC(pbsSlice) : pbsSlice;
    if (pbsBuilt !== o.pbs.seq) throw new Error(c.locus + ': PBS rebuild ' + pbsBuilt + ' != ' + o.pbs.seq);
    const rtSliceRaw = g.slice(rtFoot[0], rtFoot[1] + 1);
    const rtEdited = rtSliceRaw.split('');
    rtEdited[c.editPos - rtFoot[0]] = c.alt;
    const rtBuilt = c.strand === '+' ? RC(rtEdited.join('')) : rtEdited.join('');
    if (rtBuilt !== o.rt.seq) throw new Error(c.locus + ': RT rebuild ' + rtBuilt + ' != ' + o.rt.seq);

    const minEditDist = c.strand === '+' ? c.editPos - c.nick : c.nick - c.editPos;

    // PAM, in + strand coordinates. SpCas9 nicks the protospacer strand 3 nt 5' of the
    // PAM, so on a + strand spacer nickPos = pamStart - 3; the tool's own comment gives
    // the minus case as nickPos = pamStart + pamLen + 2. Both are asserted against the
    // sequence rather than trusted, because a silent off-by-one here would mislabel the
    // one landmark a reader uses to orient the whole panel.
    const pamFoot = c.strand === '+' ? [c.nick + 3, c.nick + 5] : [c.nick - 5, c.nick - 3];
    const pamSeq  = g.slice(pamFoot[0], pamFoot[1] + 1);
    const pamOK   = c.strand === '+' ? /^.GG$/.test(pamSeq) : /^CC.$/.test(pamSeq);
    if (!pamOK) throw new Error(c.locus + ': PAM at ' + pamFoot + ' reads ' + pamSeq +
      ', which is not NGG on the ' + c.strand + ' strand');

    const lo = Math.min(pbsFoot[0], rtFoot[0], pamFoot[0]) - 2;
    const hi = Math.max(pbsFoot[1], rtFoot[1], pamFoot[1]) + 2;
    const out = Object.assign({}, c, {ref, pbs:o.pbs, rt:o.rt,
      pbsFoot, rtFoot, pamFoot, pamSeq, pamRead: c.strand === '+' ? pamSeq : RC(pamSeq),
      pbsSlice, rtSliceRaw, minEditDist,
      window:{lo, hi, top:g.slice(lo, hi+1), bot:comp(g.slice(lo, hi+1))},
      overlap: Math.max(0, Math.min(pbsFoot[1], rtFoot[1]) - Math.max(pbsFoot[0], rtFoot[0]) + 1)});
    console.log(`${c.letter}  ${c.locus} ${c.strand}  nick ${c.nick}  edit g.${c.editPos+1} ${ref}>${alt}` +
      `  PAM ${pamSeq} @${pamFoot[0]+1}-${pamFoot[1]+1}  PBS ${o.pbs.len} nt ${o.pbs.seq}` +
      `  RT ${o.rt.len} nt ${o.rt.seq}  hom ${o.rt.hom}  nick->edit ${minEditDist}` +
      `  window ${hi-lo+1} cols  overlap ${out.overlap}`);
    return out;
  });
})();

/* ══ PART 2 — draw ════════════════════════════════════════════════════════ */
const C = {
  ink:'1A1A1A', mid:'4A4A4A', soft:'8A8A8A', rule:'C9CDD2', hair:'E8EAEC', grey:'F4F5F6',
  blue:'0072B2', green:'009E73', verm:'D55E00', amber:'E69F00', purple:'CC79A7',
  pbsF:'DDEAF6', rtF:'DDF1E9', pamF:'F3E4EE', editF:'F9DEB3', editE:'D98B2B'
};
const F = 'Arial', M = 'Courier New';
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.author = 'Plant Prime Editor';
pres.title  = 'Supplementary Figure S1 — PBS and RT template derivation on each strand';
const s = pres.addSlide(); s.background = {color:'FFFFFF'};

const BOXES = [];
const T = (o,x,y,w,h,op={}) => {
  const txt = (typeof o === 'string') ? o : o.map(r => r.text).join('');
  const pt  = (typeof o === 'string') ? 8 : Math.max(...o.map(r => (r.options && r.options.fontSize) || 8));
  const bold = (typeof o !== 'string') && o.some(r => r.options && r.options.bold);
  const mono = (typeof o !== 'string') && o.some(r => r.options && r.options.fontFace === M);
  BOXES.push({x,y,w,h,txt,pt,bold,mono});
  return s.addText(o, Object.assign({x,y,w,h,isTextBox:true,margin:0,fontFace:F,color:C.ink,valign:'top'}, op));
};
const LN = (x1,y1,x2,y2,col,wpt,dash,arrow,arrowStart) => s.addShape(pres.ShapeType.line,{
  x:Math.min(x1,x2), y:Math.min(y1,y2), w:Math.abs(x2-x1), h:Math.abs(y2-y1),
  line:Object.assign({color:col,width:wpt}, dash?{dashType:dash}:{},
    arrow?{endArrowType:'triangle'}:{}, arrowStart?{beginArrowType:'triangle'}:{}),
  flipH:x2<x1, flipV:y2<y1});
const R = (x,y,w,h,fill,lineCol,lineW,rad) => s.addShape(rad ? pres.ShapeType.roundRect : pres.ShapeType.rect,
  Object.assign({x,y,w,h,
    fill: fill ? {color:fill} : {type:'none'},
    line: lineCol ? {color:lineCol, width:lineW===undefined?0.75:lineW} : {type:'none'}},
    rad ? {rectRadius:rad} : {}));
const AW = {' ':0.278,'.':0.278,',':0.278,'·':0.333,'/':0.278,'(':0.333,')':0.333,'-':0.333,"'":0.191,
  '–':0.556,'—':1.000,'−':0.584,'+':0.584,'×':0.584,'≥':0.549,'≈':0.549,'=':0.584,'%':0.889,'…':1.000,
  '→':0.838,'←':0.838,'[':0.278,']':0.278,'Δ':0.667,'°':0.400,':':0.278,'′':0.191,'’':0.191,'<':0.584};
function adv(ch){
  if (AW[ch] !== undefined) return AW[ch];
  if (ch >= '0' && ch <= '9') return 0.556;
  if (ch >= 'a' && ch <= 'z') return 'ijl'.includes(ch)?0.222 : 'ft'.includes(ch)?0.278 : 'mw'.includes(ch)?0.836 : 0.556;
  if (ch >= 'A' && ch <= 'Z') return 'IJ'.includes(ch)?0.290 : 'MW'.includes(ch)?0.870 : 0.690;
  return 0.620;
}
const widthIn = (t,pt,bold) => [...t].reduce((a,c)=>a+adv(c),0)*(bold?1.05:1)*pt/72;
const monoIn  = (t,pt) => t.length*0.600*pt/72;

const MPT = 20, CW = 0.600*MPT/72;            // monospace point size and column width

function panel(c, PY) {
  const SX = 1.30;                             // left edge of the sequence columns
  const cx = i => SX + i*CW;                   // left edge of the column for window.lo + i
  const col = g => cx(g - c.window.lo);        // + strand genomic index → x
  const n = c.window.top.length;
  const plus = c.strand === '+';

  /* one fixed row grid, so nothing has to be nudged by eye ─────────────────
       yNick(+)  the nick label, above the footprint bars, when it sits on the top strand
       yFoot     the three footprint bars
       yTop      the + strand bases          yTick  the base-pairing ticks
       yBot      the − strand bases
       yNick(−)  the nick label, below, when it sits on the bottom strand
       yM        the two margin arrows                                        */
  const yPam  = PY + 0.32;
  const yFoot = PY + 0.55, yTop = PY + 0.80, yTick = PY + 1.12, yBot = PY + 1.21;
  const yNick = plus ? yPam : yBot + 0.34;
  const yM    = plus ? yBot + 0.38 : yBot + 0.56;

  T([{text:c.letter, options:{fontSize:15, bold:true}}], 0.55, PY, 0.28, 0.28);
  T([{text:`${plus ? 'Plus' : 'Minus'}-strand spacer`, options:{fontSize:11.5, bold:true}},
     {text:`   ${c.locus} · nick after g.${plus ? c.nick : c.nick+1}` +
           ` · ${c.ref}→${c.alt} at g.${c.editPos+1} · PAM ${c.pamRead}`,
      options:{fontSize:8.5, color:C.mid}}], 0.85, PY+0.04, 7.3, 0.21);

  /* ── pass 1: every fill that sits BEHIND the bases ────────────────────── */
  const span = rng => ({x: col(rng[0]), w: (rng[1]-rng[0]+1)*CW});
  [[c.pbsFoot, C.pbsF], [c.rtFoot, C.rtF], [c.pamFoot, C.pamF]].forEach(([rng, fill]) => {
    const {x,w} = span(rng);
    R(x, yTop-0.02, w, 0.32, fill, null, 0);
    R(x, yBot-0.02, w, 0.32, fill, null, 0);
  });
  R(col(c.editPos)-0.008, yTop-0.025, CW+0.016, 0.33, C.editF, C.editE, 1.1, 0.015);
  R(col(c.editPos)-0.008, yBot-0.025, CW+0.016, 0.33, C.editF, C.editE, 1.1, 0.015);
  for (let i=0;i<n;i++) LN(cx(i)+CW/2, yTick, cx(i)+CW/2, yTick+0.065, C.hair, 0.8);

  /* ── pass 2: the bases themselves, on top of the fills ────────────────── */
  const flank = (t,y,x,al) => T([{text:t, options:{fontSize:9, color:C.mid}}], x, y+0.08, 0.30, 0.16, {align:al});
  flank('5′', yTop, SX-0.42, 'right');  flank('3′', yTop, SX+n*CW+0.12, 'left');
  flank('3′', yBot, SX-0.42, 'right');  flank('5′', yBot, SX+n*CW+0.12, 'left');
  T([{text:c.window.top, options:{fontSize:MPT, fontFace:M, charSpacing:0}}], SX, yTop, n*CW+0.02, 0.30);
  T([{text:c.window.bot, options:{fontSize:MPT, fontFace:M, color:C.mid, charSpacing:0}}], SX, yBot, n*CW+0.02, 0.30);
  // the PAM lies inside the RT footprint and its last base is the edited one, so its
  // fill alone is ambiguous — outline the three columns on top of everything
  {
    const {x,w} = span(c.pamFoot);
    R(x, yTop-0.025, w, 0.33, null, C.purple, 1.0, 0.015);
  }

  /* ── pass 3: the footprint bars, in + strand coordinates because that is
        how both functions slice, and the nick ─────────────────────────────── */
  const foot = (rng, y, h, fill, edge, label) => {
    const {x,w} = span(rng);
    R(x, y, w, h, fill, edge, 0.9, 0.02);
    T([{text:label, options:{fontSize:7, bold:true, color:edge}}], x+0.02, y+h/2-0.053, w-0.04, 0.12, {align:'center'});
  };
  // the PAM gets its own row: it lies INSIDE the RT footprint on both strands, so a bar
  // on the same row would sit on top of one and its label on top of the other
  foot(c.pamFoot, yPam,  0.16, C.pamF, C.purple, 'PAM');
  foot(c.pbsFoot, yFoot, 0.18, C.pbsF, C.blue,  `PBS · ${c.pbs.len} nt`);
  foot(c.rtFoot,  yFoot, 0.18, C.rtF,  C.green, `RT template · ${c.rt.len} nt`);

  // the cut lies between the last PBS base and the first RT base, on the strand the
  // spacer does not pair with: the + strand for a + spacer, the − strand for a − spacer
  const nx = plus ? col(c.nick) : col(c.nick) + CW;
  const ny = plus ? yTop : yBot;
  LN(nx, ny-0.03, nx, ny+0.31, C.verm, 2.4);
  T([{text:'nick', options:{fontSize:7.5, bold:true, color:C.verm}}],
    nx-0.32, yNick, 0.64, 0.14, {align:'center'});
  LN(nx, plus ? yNick+0.16 : yNick-0.02, nx, plus ? yFoot-0.01 : ny+0.31, C.verm, 0.8, 'dash');

  /* ── pass 4: the two margins the tool enforces, at opposite ends of the RT
        template. They are separate constraints and this is the only place in the
        paper where both are drawn. ────────────────────────────────────────── */
  const mid = g => col(g) + CW/2;
  const distal = plus ? c.rtFoot[1] : c.rtFoot[0];
  const arrow = (y, a, b, colr, label, halfW) => {
    LN(Math.min(a,b), y, Math.max(a,b), y, colr, 1.3, undefined, true, true);
    T([{text:label, options:{fontSize:7, color:colr}}],
      (a+b)/2 - halfW, y+0.04, halfW*2, 0.13, {align:'center'});
  };
  arrow(yM, mid(c.editPos), mid(distal), C.green,
        `${c.rt.hom} nt homology beyond the edit`, 1.10);
  arrow(yM+0.26, mid(c.editPos), nx, C.blue,
        `${c.minEditDist} nt from the nick`, 0.82);

  /* ── right: the formulas, with the intermediate spelled out ────────────── */
  const RX = 8.30, RW = 4.48;
  const fml = (y, tag, tagCol, formula, slice, arrowTxt, result) => {
    T([{text:tag, options:{fontSize:8.5, bold:true, color:tagCol}}], RX, y, 0.88, 0.15);
    T([{text:formula, options:{fontSize:8, color:C.ink}}], RX+0.92, y, RW-0.92, 0.15);
    T([{text:slice, options:{fontSize:8.5, fontFace:M, color:C.mid}}], RX+0.92, y+0.19, RW-0.92, 0.16);
    T([{text:arrowTxt, options:{fontSize:7, color:C.soft}}], RX+0.92, y+0.38, RW-0.92, 0.13);
    T([{text:result, options:{fontSize:8.5, fontFace:M, bold:true, color:tagCol}}], RX+0.92, y+0.53, RW-0.92, 0.16);
  };
  fml(PY+0.30, 'PBS', C.blue,
      plus ? `RC( genomic[ ${c.pbsFoot[0]+1} .. ${c.pbsFoot[1]+1} ] ) — upstream of the nick`
           : `genomic[ ${c.pbsFoot[0]+1} .. ${c.pbsFoot[1]+1} ] — downstream of the nick`,
      c.pbsSlice,
      plus ? 'reverse-complemented' : 'taken directly — no outer reverse complement',
      c.pbs.seq);
  fml(PY+1.06, 'RT template', C.green,
      plus ? `RC( genomic[ ${c.rtFoot[0]+1} .. ${c.rtFoot[1]+1} ] with the edit )`
           : `genomic[ ${c.rtFoot[0]+1} .. ${c.rtFoot[1]+1} ] with the edit`,
      c.rtSliceRaw,
      plus ? `edit ${c.ref}→${c.alt} applied, then reverse-complemented`
           : `edit ${c.ref}→${c.alt} applied — no outer reverse complement`,
      c.rt.seq);
  T([{text:`Footprints share no base: PBS ${c.pbsFoot[0]+1}–${c.pbsFoot[1]+1}, RT ${c.rtFoot[0]+1}–${c.rtFoot[1]+1}, overlap ${c.overlap} nt.`,
     options:{fontSize:7.5, color:C.mid}}], RX, PY+1.86, RW, 0.14);
  return yM + 0.44;
}

panel(D[0], 1.02);
panel(D[1], 3.62);

/* ── one key and one note for both panels ───────────────────────────────── */
{
  const KY = 6.14;
  [[C.pbsF, C.blue, 'PBS footprint', 0.55, 0.75], [C.rtF, C.green, 'RT template footprint', 1.62, 1.05],
   [C.pamF, C.purple, 'PAM', 3.10, 0.45], [C.editF, C.editE, 'the edited base', 3.95, 0.80]]
    .forEach(([f,e,lab,x,lw]) => {
      R(x, KY+0.025, 0.18, 0.11, f, e, 0.9, 0.02);
      T([{text:lab, options:{fontSize:7.5}}], x+0.25, KY, lw, 0.14);
    });
  LN(5.20, KY+0.08, 5.50, KY+0.08, C.verm, 2.4);
  T([{text:'the nick, on the strand the spacer does not pair with', options:{fontSize:7.5}}],
    5.57, KY, 2.70, 0.14);
  T([{text:'Both designs are real output of the shipped build, and the redraw asserts that reapplying each formula to the genomic slice reproduces the sequence the build returned \u2014 so a sign error in this figure would stop it from being drawn at all. Each panel installs the substitution published at its own protospacer, and at both it falls five bases into the template; because SpCas9 nicks exactly three bases from the PAM, that position falls on the PAM in both panels, so the edited allele can no longer be cut. In B the PAM is printed as it reads on the minus strand; the bases beneath it are the plus strand. Two margins bound the edit and the tool enforces them separately: at least 5 nt of genomic homology beyond the farthest edit, away from the nick, so the nascent 3\u2032 flap can anneal and be ligated (10\u201315 nt preferred), and a nearest-edit distance from the nick that scores best at 5\u201310 nt.',
     options:{fontSize:7.5, color:C.mid}}], 0.55, KY+0.24, 12.23, 0.56, {lineSpacing:9.5});
}

T([{text:'Supplementary Figure S1.  ', options:{fontSize:13.5, bold:true}},
   {text:'Primer-binding-site and reverse-transcriptase template derivation on the plus and minus strand',
    options:{fontSize:13.5}}], 0.55, 0.24, 12.4, 0.28);
T([{text:'A sign error here produces a non-functional pegRNA with no visible symptom, so both cases are handled explicitly and both are shown with real sequence rather than as a schematic.',
   options:{fontSize:9.5, color:C.mid}}], 0.55, 0.57, 12.4, 0.22);
T([{text:'Plant Prime Editor v1.0 · regenerated by analysis/build_figureS1_editable.js · every element is a native, editable PowerPoint object',
   options:{fontSize:8, color:'AAAAAA'}}], 0.55, 7.20, 12.4, 0.18);
s.addNotes('Supplementary Figure S1. Genomic duplex with the pegRNA-directed nick marked, for a plus-strand spacer (A) and a minus-strand spacer (B), both real designs from the shipped build. For a plus-strand spacer the PBS is the reverse complement of the region immediately 5-prime of the nick and the RT template the reverse complement of the region 3-prime of it; for a minus-strand spacer both are taken directly, without an outer reverse complement. PBS and RT footprints are non-overlapping by construction. Two margins bound the edit and are enforced separately: homology beyond the farthest edit at the distal end (at least 5 nt, 10-15 preferred) and the nearest-edit distance from the nick (best at 5-10 nt). Geometry after Anzalone et al. 2019, Figure 1c.');

/* ══ layout audit ═════════════════════════════════════════════════════════ */
let bad = 0;
for (let a=0; a<BOXES.length; a++) for (let b=a+1; b<BOXES.length; b++) {
  const p=BOXES[a], q=BOXES[b];
  const ox = Math.min(p.x+p.w,q.x+q.w) - Math.max(p.x,q.x);
  const oy = Math.min(p.y+p.h,q.y+q.h) - Math.max(p.y,q.y);
  if (ox > 0.004 && oy > 0.004) { bad++;
    console.log(`OVERLAP  "${p.txt.slice(0,28)}" x "${q.txt.slice(0,28)}"  ${ox.toFixed(3)}x${oy.toFixed(3)}`); }
}
BOXES.forEach(p => {
  if (p.x < 0.02 || p.x+p.w > 13.31 || p.y < 0.02 || p.y+p.h > 7.48) { bad++;
    console.log(`OFF-SLIDE "${p.txt.slice(0,32)}"  x ${p.x.toFixed(2)}..${(p.x+p.w).toFixed(2)}  y ${p.y.toFixed(2)}..${(p.y+p.h).toFixed(2)}`); }
  const lines = Math.max(1, Math.floor(p.h/(p.pt*1.18/72)));
  const t = p.txt.split('\n')[0];
  const need = p.mono ? monoIn(t,p.pt) : widthIn(t,p.pt,p.bold);
  if (need > p.w*(lines===1?1:lines*0.93) + 0.004) { bad++;
    console.log(`OVERFLOW "${t.slice(0,40)}"  needs ${need.toFixed(2)}, box ${p.w.toFixed(2)} x ${lines} line(s)`); }
});
console.log(bad===0 ? `layout audit: ${BOXES.length} text boxes, no overlaps, no overflow, nothing off-slide`
                    : `layout audit: ${bad} problem(s)`);
pres.writeFile({fileName: 'FigureS1_editable.pptx'}).then(f => console.log('written', f));
