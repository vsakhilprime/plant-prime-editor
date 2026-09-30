// Figure 1 — From allelic variant to cloning-ready construct
// Every element is a native, editable PowerPoint object. Geometry is computed,
// not eyeballed: every text box has a declared box and rows are laid on a fixed
// pitch, so nothing can wrap into its neighbour.
const pptxgen = require('pptxgenjs');
// The build stamp is READ from the tool, not typed. It was typed until 30 September 2026
// and said 96e270bb, a build that stopped existing on 23 August; build_figure2_editable.js
// had always read it. A figure carrying a stamp its own tool disagrees with is worse than
// a figure carrying none, because the stamp is what pins a panel to a build.
process.env.PPE_HTML = process.env.PPE_HTML ||
  (require('path').resolve(__dirname, '..') + '/plant_prime_editor_v1.0.html');
const FP = require('vm').runInContext(
  '(typeof PPE_BUILD!=="undefined"&&PPE_BUILD.fingerprint)||"unknown"',
  require(require('path').resolve(__dirname, '..') + '/tests/lib/load_tool.js').ctx);

const C = {
  ink:'1A1A1A', mid:'4A4A4A', soft:'8A8A8A', rule:'D8D8D8', hair:'E8EAEC',
  m1:'0072B2', m1t:'E7F0F7',
  m2:'009E73', m2t:'E4F2EE',
  m3:'B8621B', m3t:'F7ECE2',
  da:'6B6B6B', rs:'5B4B8A', rst:'EDEAF4'
};
const F = 'Arial';

const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.author = 'Plant Prime Editor';
pres.title  = 'Figure 1 — From allelic variant to cloning-ready construct';
const s = pres.addSlide(); s.background = { color:'FFFFFF' };

// every text box is recorded so the layout can be checked for collisions and for
// text that would overflow its declared width (see the audit at the foot of this file)
const BOXES = [];
const T = (o,x,y,w,h,op={}) => {
  const txt = (typeof o === 'string') ? o : o.map(r => r.text).join('');
  const pt  = (typeof o === 'string') ? 8 : Math.max(...o.map(r => (r.options && r.options.fontSize) || 8));
  BOXES.push({x,y,w,h,txt,pt});
  return s.addText(o, Object.assign(
    {x,y,w,h,isTextBox:true,margin:0,fontFace:F,color:C.ink,valign:'top'}, op));
};
const LN = (x1,y1,x2,y2,col,wpt,dash,arrow) => s.addShape(pres.ShapeType.line,{
  x:Math.min(x1,x2), y:Math.min(y1,y2), w:Math.abs(x2-x1), h:Math.abs(y2-y1),
  line:Object.assign({color:col,width:wpt}, dash?{dashType:dash}:{}, arrow?{endArrowType:'triangle'}:{}),
  flipH:x2<x1, flipV:y2<y1 });
const BOX = (x,y,w,h,fill,lineCol,lineW,rad,dash) => s.addShape(
  rad ? pres.ShapeType.roundRect : pres.ShapeType.rect,
  Object.assign({x,y,w,h,
    fill: fill ? {color:fill} : {type:'none'},
    line: Object.assign({color:lineCol,width:lineW}, dash?{dashType:dash}:{})},
    rad ? {rectRadius:rad} : {}));
const DOT = (cx,cy,d,col) => s.addShape(pres.ShapeType.ellipse,
  {x:cx-d/2, y:cy-d/2, w:d, h:d, fill:{color:col}, line:{width:0}});

// ── layout constants ─────────────────────────────────────────────────────────
const PX = [0.55, 4.89, 9.23];          // panel left edges
const PW = 3.55;                        // panel width  (gutter = 0.79)
const PT = 1.32, PH = 4.56;             // panel top / height  → bottom 5.88
const PAD = 0.20;                       // panel inner padding
const HDR = 0.54;                       // header band height
const PITCH = 0.175;                    // item row pitch — fixed, so rows cannot collide
const SEC_LBL = 0.28;                   // section label + rule, before the first item
const TX = i => PX[i] + 0.34;           // item text left edge
const TW = PW - 0.34 - PAD;             // item text width  (3.01 in)
// The three section bands sit on the SAME rows in all three panels, sized by the
// longest list in each band (INPUT 4, COMPUTATION 6, OUTPUT 5). Every row position
// is therefore fixed before any text is placed, so no two rows can collide.
const SEC_Y = [1.98, 3.11, 4.59];       // INPUT / COMPUTATION / OUTPUT header rows

// ── one module column ────────────────────────────────────────────────────────
function module_(i, accent, tint, num, name, sections) {
  const x = PX[i];
  BOX(x, PT, PW, PH, 'FFFFFF', accent, 1.25, 0.02);          // panel
  BOX(x, PT, PW, HDR, tint, accent, 1.25, 0.02);             // header band
  BOX(x, PT + HDR - 0.012, PW, 0.012, accent, accent, 0);    // header underline
  T([{text:num, options:{fontSize:8, bold:true, color:accent, charSpacing:1.2}}],
    x + PAD, PT + 0.075, PW - 2*PAD, 0.16);
  T([{text:name, options:{fontSize:11.5, bold:true}}],
    x + PAD, PT + 0.245, PW - 2*PAD, 0.24);

  sections.forEach(([label, items], k) => {
    const y = SEC_Y[k];
    T([{text:label, options:{fontSize:7.5, bold:true, color:accent, charSpacing:0.9}}],
      x + PAD, y, PW - 2*PAD, 0.16);
    LN(x + PAD, y + 0.19, x + PW - PAD, y + 0.19, C.hair, 0.75);
    items.forEach((it, r) => {
      const ry = y + SEC_LBL + r*PITCH;
      DOT(x + PAD + 0.055, ry + 0.083, 0.05, accent);
      T([{text:it, options:{fontSize:8, color:C.ink}}], TX(i), ry, TW, 0.16);
    });
  });
}

// ── Module 1 ────────────────────────────────────────────────────────────────
module_(0, C.m1, C.m1t, 'MODULE 1', 'Allelic variant discovery', [
  ['INPUT', [
    'coding sequence to be edited',
    'one or more reference alleles',
    'reading frame · species group'
  ]],
  ['COMPUTATION', [
    'banded Needleman–Wunsch, affine gaps',
    'variant calls in codon context',
    'amino-acid consequence class',
    'Smith–Waterman CDS → genomic map',
    'look-ups into 8 plant genome resources'
  ]],
  ['OUTPUT', [
    'variant table (SNP / insertion / deletion)',
    'amino-acid impact class',
    'genomic coordinate of each edit',
    'melting-temperature target for the group',
    'variant table CSV'
  ]]
]);

// ── Module 2 ────────────────────────────────────────────────────────────────
module_(1, C.m2, C.m2t, 'MODULE 2', 'pegRNA design', [
  ['INPUT', [
    'genomic sequence',
    'selected edit or edits',
    'prime editing architecture (11)',
    'PAM motif'
  ]],
  ['COMPUTATION', [
    'both-strand IUPAC PAM scan',
    'spacer composite score, term by term',
    'PBS ΔG landscape · 3 scored channels',
    'RT template · explicit strand geometry',
    'linker chosen from 19 by ΔG',
    'second component for dual architectures'
  ]],
  ['OUTPUT', [
    'ranked spacer candidates',
    'PBS length landscape (8–17 nt default)',
    'RT template with homology check',
    'assembled pegRNA',
    'nicking sgRNA or partner pegRNA'
  ]]
]);

// ── Module 3 ────────────────────────────────────────────────────────────────
module_(2, C.m3, C.m3t, 'MODULE 3', 'Vector selection and assembly', [
  ['INPUT', [
    'pegRNA design',
    'plant species',
    'assembly chemistry'
  ]],
  ['COMPUTATION', [
    'vector ranking (15 profiled)',
    'BsaI / BsmBI / BbsI / Esp3I conflict scan',
    'automatic switch of assembly chemistry',
    'overlap-extension primer build',
    'Tm / GC / GC-clamp / hairpin QC'
  ]],
  ['OUTPUT', [
    'primers P1–P12 (PT1–PT4 for twinPE)',
    'per-primer QC table',
    'PCR cycling conditions',
    'bench protocol',
    'four export formats'
  ]]
]);

// ── state hand-off arrows, centred in the gutters ────────────────────────────
const AY = 3.44;
[0,1].forEach(i => {
  const gx0 = PX[i] + PW, gx1 = PX[i+1];
  LN(gx0 + 0.06, AY, gx1 - 0.06, AY, C.mid, 1.6, undefined, true);
  // two single-line boxes rather than one wrapped box: each is centred in the
  // gutter on its own row, so neither can drift into a panel border
  T([{text:'state', options:{fontSize:7, color:C.mid}}],
    gx0, AY + 0.11, gx1 - gx0, 0.15, {align:'center'});
  T([{text:'hand-off', options:{fontSize:7, color:C.mid}}],
    gx0, AY + 0.26, gx1 - gx0, 0.15, {align:'center'});
});

// ── Direct Assembly bypass, above the panels ─────────────────────────────────
const DAY = 1.05, DAX = 2.62, DAT = PX[2] + PW/2;
BOX(0.55, DAY - 0.19, 1.95, 0.38, 'FFFFFF', C.da, 1.0, 0.06, 'dash');
T([{text:'existing pegRNA design', options:{fontSize:8, color:C.mid}}],
  0.62, DAY - 0.075, 1.81, 0.16, {align:'center'});
LN(DAX, DAY, DAT, DAY, C.da, 1.2, 'dash');
LN(DAT, DAY, DAT, PT - 0.02, C.da, 1.2, 'dash', true);
T([{text:'Direct Assembly mode — Module 3 alone', options:{fontSize:8, italic:true, color:C.mid}}],
  DAX + 0.14, DAY - 0.235, 3.20, 0.18);

// ── six reset points ─────────────────────────────────────────────────────────
const RY = 6.24, RH = 0.66, RW = 1.94, RSTEP = (12.78 - 0.55 - RW) / 5;
T([{text:'SIX TARGETED RESET POINTS', options:{fontSize:7.5, bold:true, color:C.rs, charSpacing:0.9}},
   {text:'   each preserves the data it is not resetting', options:{fontSize:8, color:C.mid, charSpacing:0}}],
  0.55, 6.00, 8.0, 0.17);
LN(0.55, 6.19, 12.78, 6.19, C.hair, 0.75);
const RESETS = [
  ['Full session reset', ''],
  ['Start Fresh', 'home page'],
  ['M1 · Clear sequences', 'keeps M2 and M3'],
  ['M2 · Re-design', 'keeps genomic sequence'],
  ['M3 · Start new design', ''],
  ['Direct Assembly', 'Clear fields']
];
RESETS.forEach(([a,b], i) => {
  const x = 0.55 + i*RSTEP;
  BOX(x, RY, RW, RH, C.rst, C.rs, 0.9, 0.06);
  const runs = [{text:a, options:{fontSize:7.5, bold:true, color:C.ink}}];
  if (b) runs.push({text:'\n'+b, options:{fontSize:7, color:C.mid, breakLine:false}});
  T(runs, x + 0.08, RY + (b ? 0.145 : 0.245), RW - 0.16, b ? 0.40 : 0.20,
    {align:'center', lineSpacing:9.5});
});

// ── titles and footer ────────────────────────────────────────────────────────
T([{text:'Figure 1.  ', options:{fontSize:13.5, bold:true}},
   {text:'From allelic variant to cloning-ready construct', options:{fontSize:13.5}}],
  0.55, 0.24, 12.4, 0.28);
T([{text:'Three chained modules with automatic state hand-off. No external analysis service is called at any stage; the eight genome resources are consulted only to retrieve sequence.',
   options:{fontSize:9.5, color:C.mid}}], 0.55, 0.57, 12.4, 0.22);
T([{text:`Plant Prime Editor v1.0 · build ${FP} · every element is a native, editable PowerPoint object`,
   options:{fontSize:8, color:'AAAAAA'}}], 0.55, 7.20, 12.4, 0.18);

s.addNotes('Figure 1. Three chained modules with automatic state hand-off. Module 1 calls variants by banded Needleman-Wunsch with affine (Gotoh) gap penalties and maps them to genomic coordinates by Smith-Waterman. Module 2 scans both strands for PAMs, scores spacers, and returns the PBS free-energy landscape over three scored channels with PBS-to-RT reported alongside. Module 3 ranks 15 profiled binary vectors, scans the insert for internal sites of the vector enzyme and nine backbone enzymes, and builds overlap-extension primers. Dashed path: Direct Assembly mode, Module 3 alone. Six targeted reset points, each preserving the data it is not resetting.');

// ── layout audit ─────────────────────────────────────────────────────────────
// 1. no two text boxes may overlap  2. no string may exceed its declared width.
// Arial advance widths at 1 pt, measured from the font's hmtx table for the
// characters this figure actually uses; 0.60 em is used for anything unmeasured.
const AW = {' ':0.278,'.':0.278,',':0.278,'·':0.333,'/':0.278,'(':0.333,')':0.333,
  '–':0.556,'—':1.000,'-':0.333,'→':0.838,'Δ':0.667,'°':0.400,':':0.278,'’':0.191};
const LOWER = 'abcdefghijklmnopqrstuvwxyz', DIG = '0123456789';
function adv(ch){
  if (AW[ch] !== undefined) return AW[ch];
  if (DIG.includes(ch)) return 0.556;
  if (LOWER.includes(ch)) return 'ijlt'.includes(ch) ? 0.246 : ('fr'.includes(ch) ? 0.315 : ('mw'.includes(ch) ? 0.836 : 0.556));
  if (ch >= 'A' && ch <= 'Z') return 'IJ'.includes(ch) ? 0.290 : ('MW'.includes(ch) ? 0.870 : 0.690);
  return 0.600;
}
const widthIn = (t, pt, bold, spacing) =>
  ([...t].reduce((a,c) => a + adv(c), 0) * (bold ? 1.045 : 1) * pt + (spacing||0) * t.length) / 72;

let bad = 0;
for (let a = 0; a < BOXES.length; a++)
  for (let b = a+1; b < BOXES.length; b++) {
    const p = BOXES[a], q = BOXES[b];
    const ox = Math.min(p.x+p.w, q.x+q.w) - Math.max(p.x, q.x);
    const oy = Math.min(p.y+p.h, q.y+q.h) - Math.max(p.y, q.y);
    if (ox > 0.004 && oy > 0.004) { bad++;
      console.log(`OVERLAP  "${p.txt.slice(0,34)}" × "${q.txt.slice(0,34)}"  ${ox.toFixed(3)}×${oy.toFixed(3)} in`); }
  }
BOXES.forEach(p => {
  const first = p.txt.split('\n')[0];
  const w = widthIn(first, p.pt, /Figure 1|MODULE|INPUT|COMPUT|OUTPUT|SIX /.test(first), 0);
  if (w > p.w + 0.002) { bad++;
    console.log(`OVERFLOW "${first.slice(0,44)}"  needs ${w.toFixed(2)} in, box is ${p.w.toFixed(2)} in`); }
});
console.log(bad === 0
  ? `layout audit: ${BOXES.length} text boxes, no overlaps, no overflow`
  : `layout audit: ${bad} problem(s)`);

pres.writeFile({fileName:'Figure1_pipeline_editable.pptx'}).then(f => console.log('written', f));
