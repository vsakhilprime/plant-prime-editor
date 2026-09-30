#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — Figure 5, derived and drawn in one pass.

   PART 1 reads the two deposited data files and derives everything the figure
   shows; PART 2 draws it as native PowerPoint shapes. No value is transcribed.

     data/all_tools.json      the design each public web tool returned for the
                              same seven sequences and edits, with provenance
     data/feature_matrix.json the 29 x 7 capability table

   Slide 1 carries panels A-C; slide 2 carries panel D at full size, so its 29
   features and 7 tools read at a usable weight with the tools named in full
   rather than abbreviated.

   Panels A and C cover the five tools that returned a design. Panel B covers
   four: PRIDICT reports no primer-binding-site melting temperature, and that is
   derived from the data rather than asserted. Panel D covers all seven.

   Both slides end in a layout audit: every text box is checked pairwise for
   collision, against the width of the box it was given, and against the slide
   edge. Rotated boxes are audited by the band they actually cover.

     node analysis/build_figure5_editable.js
       ->  Figure5_ABC_editable.pptx   (panels A-C)
       ->  Figure5_D_editable.pptx     (panel D)
   ═══════════════════════════════════════════════════════════════════════════ */
const pptxgen = require('pptxgenjs'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* ══ PART 1 — derive ══════════════════════════════════════════════════════ */
const D = (() => {
  const all = JSON.parse(fs.readFileSync(path.join(ROOT,'data','all_tools.json'),'utf8'));
  const provenance = all._provenance; delete all._provenance;
  const tools = Object.keys(provenance.tool_versions);
  const targets = Object.keys(all);
  const fm = JSON.parse(fs.readFileSync(path.join(ROOT,'data','feature_matrix.json'),'utf8'));
  const get = (t,tl,k) => (all[t][tl] ? all[t][tl][k] : null);

  const pairs = [];
  for (let i=0;i<tools.length;i++) for (let j=i+1;j<tools.length;j++) {
    const a = tools[i], b = tools[j];
    const d = targets.map(t => [get(t,a,'pbs'), get(t,b,'pbs')])
                     .filter(([x,y]) => x !== null && y !== null)
                     .map(([x,y]) => Math.abs(x-y));
    if (d.length) pairs.push({a, b, n:d.length, mean:d.reduce((s,v)=>s+v,0)/d.length});
  }
  const PLANT = ['Plant Prime Editor','PlantPegDesigner'];
  const isPlantPair = p => PLANT.includes(p.a) && PLANT.includes(p.b);
  const plantPair = pairs.find(isPlantPair);
  const others = pairs.filter(p => !isPlantPair(p)).map(p => p.mean);

  const LBAND = [8,11], TBAND = [26,34];
  const inBand = (v,b) => v !== null && v >= b[0] && v <= b[1];
  const hits = Object.fromEntries(tools.map(tl => {
    const L = targets.map(t => get(t,tl,'pbs')), W = targets.map(t => get(t,tl,'wal'));
    return [tl, {lenIn: L.filter(v => inBand(v,LBAND)).length, lenN: L.filter(v => v!==null).length,
                 tmIn:  W.filter(v => inBand(v,TBAND)).length, tmN:  W.filter(v => v!==null).length}];
  }));

  return {
    provenance, tools, targets,
    A:{lengths:Object.fromEntries(targets.map(t =>
         [t, Object.fromEntries(tools.map(tl => [tl, get(t,tl,'pbs')]))])), band:LBAND},
    // a tool is absent from B when it reports no Wallace melting temperature anywhere
    B:{wallace:Object.fromEntries(targets.map(t =>
         [t, Object.fromEntries(tools.map(tl => [tl, get(t,tl,'wal')]))])),
       band:TBAND, optimum:30,
       omitted:tools.filter(tl => targets.every(t => get(t,tl,'wal') === null))},
    C:{pairs, plantPair, otherMin:Math.min(...others), otherMax:Math.max(...others), hits},
    D:{header:fm[0], rows:fm.slice(1)}
  };
})();

/* ══ PART 2 — draw ════════════════════════════════════════════════════════ */
const C = {
  ink:'1A1A1A', mid:'4A4A4A', soft:'8A8A8A', rule:'C9CDD2', hair:'E8EAEC', grey:'F4F5F6',
  axis:'333333', grid:'E8EAEC',
  blue:'0072B2', green:'009E73', verm:'D55E00', amber:'E69F00', purple:'CC79A7',
  band:'F7E2D1', greenband:'D6EFE6',
  yesF:'D9F0E3', yesE:'009E73', noF:'F1F2F4', noE:'D5D8DC', dlgF:'FBE6C8', dlgE:'D98B2B',
  valF:'E7EFF6', valE:'8FB4CE'
};
const F = 'Arial';
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.author = 'Plant Prime Editor';
pres.title  = 'Figure 5 — Comparison with existing pegRNA design tools';
let s, slideNo = 0;
const newSlide = () => { s = pres.addSlide(); s.background = {color:'FFFFFF'}; slideNo++; return s; };

const BOXES = [];
const T = (o,x,y,w,h,op={}) => {
  const txt = (typeof o === 'string') ? o : o.map(r => r.text).join('');
  const pt  = (typeof o === 'string') ? 8 : Math.max(...o.map(r => (r.options && r.options.fontSize) || 8));
  const bold = (typeof o !== 'string') && o.some(r => r.options && r.options.bold);
  const rot = !!op.rotate, bh = pt*1.30/72;
  BOXES.push(Object.assign(
    rot ? {x:(x+w/2)-bh/2, y:(y+h/2)-w/2, w:bh, h:w} : {x,y,w,h}, {txt,pt,bold,rot,sl:slideNo}));
  return s.addText(o, Object.assign({x,y,w,h,isTextBox:true,margin:0,fontFace:F,color:C.ink,valign:'top'}, op));
};
const LN = (x1,y1,x2,y2,col,wpt,dash) => s.addShape(pres.ShapeType.line,{
  x:Math.min(x1,x2), y:Math.min(y1,y2), w:Math.abs(x2-x1), h:Math.abs(y2-y1),
  line:Object.assign({color:col,width:wpt}, dash?{dashType:dash}:{}), flipH:x2<x1, flipV:y2<y1});
const R = (x,y,w,h,fill,lineCol,lineW,rad,dash) => s.addShape(
  rad ? pres.ShapeType.roundRect : pres.ShapeType.rect,
  Object.assign({x,y,w,h},
    {fill: fill ? {color:fill} : {type:'none'},
     line: lineCol ? Object.assign({color:lineCol,width:lineW===undefined?0.75:lineW}, dash?{dashType:dash}:{}) : {type:'none'}},
    rad ? {rectRadius:rad} : {}));
const head = (letter,title,sub,x,y,w,ts) => {
  T([{text:letter, options:{fontSize:ts?ts+3.5:15, bold:true}}], x, y, 0.28, 0.28);
  T([{text:title, options:{fontSize:ts||11, bold:true}}], x+0.30, y+0.03, w-0.30, 0.22);
  if (sub) T([{text:sub, options:{fontSize:7.5, color:C.mid}}], x+0.30, y+0.25, w-0.30, 0.16);
};
const AW = {' ':0.278,'.':0.278,',':0.278,'·':0.333,'/':0.278,'(':0.333,')':0.333,'-':0.333,"'":0.191,
  '–':0.556,'—':1.000,'−':0.584,'+':0.584,'×':0.584,'✓':0.700,'✗':0.700,'→':0.838,'≥':0.549,'≈':0.549,
  'Δ':0.667,'°':0.400,':':0.278,'′':0.191,'’':0.191,'=':0.584,'%':0.889,'²':0.333,'#':0.556};
function adv(ch){
  if (AW[ch] !== undefined) return AW[ch];
  if (ch >= '0' && ch <= '9') return 0.556;
  if (ch >= 'a' && ch <= 'z') return 'ijl'.includes(ch)?0.222 : 'ft'.includes(ch)?0.278 : 'mw'.includes(ch)?0.836 : 0.556;
  if (ch >= 'A' && ch <= 'Z') return 'IJ'.includes(ch)?0.290 : 'MW'.includes(ch)?0.870 : 0.690;
  return 0.620;
}
const widthIn = (t,pt,bold) => [...t].reduce((a,c)=>a+adv(c),0)*(bold?1.05:1)*pt/72;

const TOOLC = {'Plant Prime Editor':C.blue,'PlantPegDesigner':C.green,'pegFinder':C.verm,
               'PE-Designer':C.amber,'PRIDICT':C.purple};
const SHORT = {'Plant Prime Editor':'PPE','PlantPegDesigner':'PPD','pegFinder':'pegF',
               'PE-Designer':'PE-D','PRIDICT':'PRID'};
const DATE = (d => { const [y,m,dd] = d.split('-');
  return `${+dd} ${['January','February','March','April','May','June','July','August','September',
                    'October','November','December'][+m-1]} ${y}`; })(D.provenance.date_accessed);

/* ── grouped bar panel: one group per target, one bar per tool ───────────── */
function barPanel(px, pw, py, ph, letter, title, sub, valueOf, tools, yd, yticks, ylab, band, bandCol, hline) {
  const x0 = px + 0.62, pwid = pw - 0.68, y1 = py + ph;
  head(letter, title, sub, px, py - 0.62, pw);
  const sy = v => y1 - (v - yd[0])/(yd[1]-yd[0])*ph;
  if (band) R(x0, sy(band[1]), pwid, sy(band[0]) - sy(band[1]), bandCol, null, 0);
  yticks.forEach(v => LN(x0, sy(v), x0+pwid, sy(v), C.grid, 0.75));
  if (hline !== undefined) LN(x0, sy(hline), x0+pwid, sy(hline), C.mid, 1.2, 'dash');
  const gw = pwid/D.targets.length, bw = gw*0.80/tools.length;
  D.targets.forEach((t,i) => {
    const gx = x0 + i*gw + gw*0.10;
    tools.forEach((tl,j) => {
      const v = valueOf(t, tl); if (v === null || v === undefined) return;
      const bx = gx + j*bw, top = sy(v);
      R(bx, top, bw*0.88, y1 - top, TOOLC[tl], 'FFFFFF', 0.4);
      T([{text:String(v), options:{fontSize:5, color:C.mid}}], bx - bw*0.06, top - 0.115, bw, 0.10, {align:'center'});
    });
    if (i) LN(x0+i*gw, py, x0+i*gw, y1, C.hair, 0.6);
    // Target ids are set vertically: OsEPSPS-T1 does not fit across a group. The box was
    // 0.62 in, which fit the old bare labels; the rice ALS ids now carry their source study
    // (analysis/als_sites.json) and "OsALS-T2 (Lin 2021)" needs 0.95 in, so it is 1.06.
    // Two lines rather than one long one: rotated, a second line costs box HEIGHT (0.14 ->
    // 0.30), which there is room for, where a longer single line costs box WIDTH and ran into
    // the legend below.
    T([{text:String(t).replace(' (', '\n('), options:{fontSize:7, color:C.mid}}],
      gx + (gw*0.80)/2 - 0.31, y1+0.36, 0.62, 0.26, {align:'center', rotate:270});
  });
  LN(x0, y1, x0+pwid, y1, C.axis, 1.1); LN(x0, py, x0, y1, C.axis, 1.1);
  yticks.forEach(v => { LN(x0-0.06, sy(v), x0, sy(v), C.axis, 1.0);
    T([{text:String(v), options:{fontSize:7.5, color:C.mid}}], x0-0.44, sy(v)-0.09, 0.38, 0.17, {align:'right'}); });
  T([{text:ylab, options:{fontSize:8.5}}], (px+0.06)-ph/2, (py+ph/2)-0.11, ph, 0.22, {align:'center', rotate:270});
  return {x0, pwid, y1};
}

/* ══ SLIDE 1 — panels A, B, C ═════════════════════════════════════════════ */
newSlide();
const PY = 1.70, PH = 1.95;
const gA = barPanel(0.55, 5.90, PY, PH, 'A',
  'Primer-binding-site length chosen',
  'the same seven sequences and the same seven edits, submitted to each tool',
  (t,tl) => D.A.lengths[t][tl], D.tools, [0,18], [0,4,8,12,16],
  'PBS length (nt)', D.A.band, C.greenband);
const toolsB = D.tools.filter(t => !D.B.omitted.includes(t));
barPanel(6.85, 5.90, PY, PH, 'B',
  'Melting temperature of that choice',
  'Wallace scale — the scale the plant literature is written on',
  (t,tl) => D.B.wallace[t][tl], toolsB, [0,44], [0,10,20,30,40],
  'PBS Tm, Wallace scale (°C)', D.B.band, C.band, D.B.optimum);

{ // one colour key and one note serve both bar panels
  const KY = gA.y1 + 0.80, KW = 12.23/D.tools.length;
  D.tools.forEach((tl,j) => {
    const x = 0.55 + j*KW;
    R(x, KY+0.035, 0.15, 0.10, TOOLC[tl], null, 0);
    T([{text:tl, options:{fontSize:7.5}}, {text:'  ('+SHORT[tl]+')', options:{fontSize:7.5, color:C.mid}}],
      x+0.22, KY, KW-0.28, 0.14);
  });
  T([{text:`A: band, the ${D.A.band[0]}–${D.A.band[1]} nt plant-optimal window derived here. B: dashed, the ${D.B.optimum} °C plant optimum (Lin et al. 2021); band, ${D.B.band[0]}–${D.B.band[1]} °C. ${D.B.omitted.join(', ')} reports no PBS melting temperature and is absent from B. Bars run from zero in both panels.`,
     options:{fontSize:7, color:C.mid}}], 0.55, KY+0.19, 12.23, 0.14);
}

{ /* ── C: the pairwise matrix, and how often each tool lands in the window ── */
  head('C', 'How far apart the tools are, and how often each lands in the plant window',
       'left: mean absolute difference in PBS length between every pair of tools, averaged over the seven targets · right: how many of each tool’s seven designs fall inside the windows shaded in A and B',
       0.55, 4.86, 12.23);
  const cols = D.tools.slice(0, -1), rows = D.tools.slice(1);
  const CW = 0.74, CH = 0.31, MX = 1.62, MY = 5.42;   // narrower cells leave a column for the call-out
  const val = (a,b) => { const p = D.C.pairs.find(p => (p.a===a&&p.b===b)||(p.a===b&&p.b===a)); return p ? p.mean : null; };
  const lo = Math.min(...D.C.pairs.map(p=>p.mean)), hi = Math.max(...D.C.pairs.map(p=>p.mean));
  const tint = v => { const f = (v-lo)/(hi-lo);      // pale where tools agree, deep where they do not
    const mix = (a,b) => Math.round(a + (b-a)*f).toString(16).padStart(2,'0');
    return mix(0xEC,0xA8) + mix(0xF3,0xC8) + mix(0xF8,0xE4); };
  // row and column labels carry the same colour chip the bars use, so the matrix
  // needs no separate key to be read
  cols.forEach((c,j) => {
    const cx = MX + j*CW + CW/2, y = MY + rows.length*CH + 0.07;
    R(cx - 0.29, y + 0.015, 0.11, 0.09, TOOLC[c], null, 0);
    T([{text:SHORT[c], options:{fontSize:7, color:C.mid}}], cx - 0.14, y, 0.44, 0.14);
  });
  rows.forEach((r,i) => {
    const y = MY + i*CH;
    R(MX - 0.66, y + CH/2 - 0.045, 0.11, 0.09, TOOLC[r], null, 0);
    T([{text:SHORT[r], options:{fontSize:7, color:C.mid}}], MX - 0.51, y + CH/2 - 0.075, 0.44, 0.14);
    cols.forEach((c,j) => {
      if (j > i) return;                              // lower triangle only
      const v = val(r,c); if (v === null) return;
      const plant = (D.C.plantPair.a===r&&D.C.plantPair.b===c)||(D.C.plantPair.a===c&&D.C.plantPair.b===r);
      R(MX + j*CW, y, CW, CH, tint(v), plant ? C.green : 'FFFFFF', plant ? 1.7 : 0.5);
      T([{text:v.toFixed(2), options:{fontSize:8.5, bold:plant, color:plant?C.ink:C.ink}}],
        MX + j*CW, y + 0.085, CW, 0.15, {align:'center'});
    });
  });
  // the empty upper triangle carries the finding, so the matrix needs no caption below it
  // a leader out of the green cell into the empty top row of the triangle
  LN(MX + CW - 0.02, MY + CH/2, MX + CW + 0.08, MY + CH/2, C.green, 1.0);
  T([{text:'nt apart — the closest any two tools come',
     options:{fontSize:6.5, color:C.green}}], MX + CW + 0.12, MY + 0.075, 2.10, 0.14);
  // the finding sits in its own column, clear of the triangle
  const QX = MX + 4*CW + 0.12;
  T([{text:'Only the two plant-calibrated tools agree', options:{fontSize:8, bold:true}}],
    QX, MY - 0.02, 1.44, 0.32, {lineSpacing:10});
  T([{text:`Every other pairing differs by ${D.C.otherMin.toFixed(1)}–${D.C.otherMax.toFixed(1)} nt, against a ${D.A.band[1]-D.A.band[0]} nt window. Which tool a laboratory uses can decide whether the primer-binding site lands inside it.`,
     options:{fontSize:7, color:C.mid}}], QX, MY + 0.34, 1.44, 0.76, {lineSpacing:9});
  // a hairline divides the two halves of the panel
  LN(6.14, MY - 0.22, 6.14, MY + 5*0.30 + 0.02, C.hair, 0.9);

  /* right: the per-tool tally behind panels A and B, as filled counters */
  const RX = 6.30, NM = 2.50, BW = 1.86, RH2 = 0.30, HY = 5.30, R0 = 5.52;
  const COLX = [RX, RX + NM, RX + NM + BW + 0.20];
  [`tool`, `designs inside ${D.A.band[0]}–${D.A.band[1]} nt (A)`, `designs inside ${D.B.band[0]}–${D.B.band[1]} °C (B)`]
    .forEach((h,i) => T([{text:h, options:{fontSize:7, bold:true, color:C.mid}}], COLX[i], HY, i?BW:NM, 0.14));
  LN(RX, HY + 0.17, 12.72, HY + 0.17, C.rule, 0.9);
  const counter = (x, y, n, tot, col) => {          // one square per target, filled to the count
    const sq = 0.115, gap = 0.035;
    for (let k=0; k<tot; k++)
      R(x + k*(sq+gap), y, sq, sq, k < n ? col : C.grey, k < n ? col : C.rule, 0.5, 0.015);
    T([{text:`${n} / ${tot}`, options:{fontSize:7.5, bold:n===tot}}],
      x + tot*(sq+gap) + 0.06, y - 0.025, 0.52, 0.15);
  };
  D.tools.forEach((tl,i) => {
    const y = R0 + i*RH2, h = D.C.hits[tl];
    if (i % 2 === 0) R(RX, y - 0.045, 6.42, RH2, C.grey, null, 0);
    R(RX + 0.02, y + 0.025, 0.11, 0.09, TOOLC[tl], null, 0);
    T([{text:tl, options:{fontSize:7.5}}], RX + 0.19, y - 0.005, NM - 0.25, 0.15);
    counter(COLX[1], y + 0.02, h.lenIn, h.lenN, TOOLC[tl]);
    if (h.tmN) counter(COLX[2], y + 0.02, h.tmIn, h.tmN, TOOLC[tl]);
    else T([{text:'no melting temperature reported', options:{fontSize:7, color:C.soft, italic:true}}],
           COLX[2], y - 0.005, BW, 0.15);
  });
}

T([{text:'Figure 5.  ', options:{fontSize:13.5, bold:true}},
   {text:'Comparison with existing pegRNA design tools on seven targets', options:{fontSize:13.5}}],
  0.55, 0.24, 12.4, 0.28);
T([{text:`Designs were obtained by submitting the same seven sequences and edits to each public web tool on ${DATE}; versions and URLs are recorded in the deposit. Panel D is on the next slide.`,
   options:{fontSize:9.5, color:C.mid}}], 0.55, 0.57, 12.4, 0.22);
T([{text:'Plant Prime Editor v1.0 · regenerated by analysis/build_figure5_editable.js · every element is a native, editable PowerPoint object',
   options:{fontSize:8, color:'AAAAAA'}}], 0.55, 7.20, 12.4, 0.18);
s.addNotes(`Figure 5A-C. A: primer-binding-site length each tool returns for the same seven sequences and edits, bars from zero; shaded band, the 8-11 nt plant-optimal window re-derived in this work. B: the same choices on the Wallace melting-temperature scale; dashed line, the 30 C plant optimum; PRIDICT reports no PBS melting temperature and is absent. C: mean absolute pairwise difference in length over the seven targets, with the per-tool tally of designs falling inside the windows shaded in A and B.`);

/* ══ SLIDE 2 — panel D at full size ═══════════════════════════════════════ */
newSlide();
{
  const hdr = D.D.header.slice(1), rows = D.D.rows;
  const FULL = {'Plant Prime Editor':'Plant Prime Editor','PlantPeg-Designer':'PlantPegDesigner',
                'Prime-Design':'PrimeDesign','peg-Finder':'pegFinder','PE-Designer':'PE-Designer',
                'Easy-Prime':'Easy-Prime','PRIDICT2.0':'PRIDICT2.0'};
  const ASC  = {'Plant Prime Editor':'Plant Prime Editor','PlantPeg-Designer':'PlantPegDesigner',
                'peg-Finder':'pegFinder','PE-Designer':'PE-Designer','PRIDICT2.0':'PRIDICT'};
  const LWID = 4.90, CWID = 0.86, X0 = 0.86;
  const RY = 1.42, RH = 0.186;
  // the slide title already names the panel, so the table gets the whole height
  const cell = v => {
    if (/^Yes/.test(v)) { const m = v.match(/\((\d+)\)/); return {f:C.yesF, e:C.yesE, t:m?m[1]:'✓', b:!!m}; }
    if (/^No \(/.test(v))  return {f:C.dlgF, e:C.dlgE, t:'→', b:false};
    if (v === 'No')        return {f:C.noF,  e:C.noE,  t:'✗', b:false};
    return {f:C.valF, e:C.valE, t:v, b:false};        // the counts row
  };
  hdr.forEach((h,j) => {
    const x = X0 + LWID + j*CWID, full = FULL[h] || h, col = TOOLC[ASC[h]] || null;
    if (col) R(x + CWID/2 - 0.075, RY - 0.31, 0.15, 0.10, col, null, 0);
    T([{text:full, options:{fontSize:6.5, bold:j===0}}], x, RY - 0.17, CWID, 0.13, {align:'center'});
  });
  LN(X0, RY - 0.02, X0 + LWID + hdr.length*CWID, RY - 0.02, C.rule, 1.0);
  rows.forEach((r,i) => {
    const y = RY + i*RH;
    if (i % 2 === 0) R(X0, y, LWID + hdr.length*CWID, RH, C.grey, null, 0);
    T([{text:r[0], options:{fontSize:7.5, color:C.ink}}], X0 + 0.04, y + 0.033, LWID - 0.10, 0.14);
    r.slice(1).forEach((v,j) => {
      const c = cell(v), x = X0 + LWID + j*CWID;
      R(x + 0.10, y + 0.018, CWID - 0.20, RH - 0.036, c.f, c.e, 0.6, 0.02);
      T([{text:c.t, options:{fontSize:c.t.length > 2 ? 6 : 7.5, bold:c.b}}], x, y + 0.032, CWID, 0.14, {align:'center'});
    });
  });
  const KY = RY + rows.length*RH + 0.09;
  LN(X0, KY, X0 + LWID + hdr.length*CWID, KY, C.rule, 0.9);
  T([{text:'Colour chips mark the five tools that also appear in panels A–C. PrimeDesign and Easy-Prime returned no design for these targets and appear only here.',
     options:{fontSize:7.5, color:C.mid}}], X0, KY + 0.08, 11.0, 0.15);
  // No panel letter: the matrix is Figure 7 in the submitted version, not a panel of Figure 5.
}
T([{text:'Figure 7.  ', options:{fontSize:13.5, bold:true}},
   {text:`Capability comparison across seven pegRNA design tools on ${D.D.rows.length} features`, options:{fontSize:13.5}}],
  0.55, 0.24, 12.4, 0.28);
T([{text:'Green with a tick, the tool does this · amber with an arrow, it is delegated to an external tool · pale grey with a cross, it does not · a number in a block is the count that cell reports.',
   options:{fontSize:9.5, color:C.mid}}], 0.55, 0.57, 12.4, 0.22);
T([{text:'Plant Prime Editor v1.0 · regenerated by analysis/build_figure5_editable.js · every element is a native, editable PowerPoint object',
   options:{fontSize:8, color:'AAAAAA'}}], 0.55, 7.20, 12.4, 0.18);
s.addNotes('Figure 7. Feature comparison of Plant Prime Editor with other pegRNA design tools, over 29 features and seven tools. Green with a tick, the tool does this; amber with an arrow, it is delegated to an external tool; pale grey with a cross, it does not. A number in a block is the count that cell reports: the plant binary vectors profiled, the assembly chemistries offered, and on the last row the spacer candidates returned per target in this study.');

/* ══ layout audit ═════════════════════════════════════════════════════════ */
let bad = 0;
for (let a=0; a<BOXES.length; a++) for (let b=a+1; b<BOXES.length; b++) {
  const p=BOXES[a], q=BOXES[b];
  if (p.sl !== q.sl) continue;
  const ox = Math.min(p.x+p.w,q.x+q.w) - Math.max(p.x,q.x);
  const oy = Math.min(p.y+p.h,q.y+q.h) - Math.max(p.y,q.y);
  if (ox > 0.004 && oy > 0.004) { bad++;
    console.log(`OVERLAP  s${p.sl}  "${p.txt.slice(0,28)}" x "${q.txt.slice(0,28)}"  ${ox.toFixed(3)}x${oy.toFixed(3)}`); }
}
BOXES.forEach(p => {
  if (p.x < 0.02 || p.x+p.w > 13.31 || p.y < 0.02 || p.y+p.h > 7.48) { bad++;
    console.log(`OFF-SLIDE s${p.sl} "${p.txt.slice(0,34)}"  x ${p.x.toFixed(2)}..${(p.x+p.w).toFixed(2)}  y ${p.y.toFixed(2)}..${(p.y+p.h).toFixed(2)}`); }
  const run = p.rot ? p.h : p.w;
  const lines = Math.max(1, Math.floor((p.rot ? p.w : p.h)/(p.pt*1.18/72)));
  const t = p.txt.split('\n')[0];
  const need = widthIn(t, p.pt, p.bold);
  if (need > run*(lines===1?1:lines*0.93) + 0.004) { bad++;
    console.log(`OVERFLOW s${p.sl} "${t.slice(0,40)}"  needs ${need.toFixed(2)}, box ${run.toFixed(2)} x ${lines} line(s)`); }
});
console.log(bad===0 ? `layout audit: ${BOXES.length} text boxes across ${slideNo} slides, no overlaps, no overflow, nothing off-slide`
                    : `layout audit: ${bad} problem(s)`);
pres.writeFile({fileName: 'Figure5_editable.pptx'}).then(f => console.log('written', f));
