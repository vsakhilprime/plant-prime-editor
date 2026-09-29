#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — Supplementary Figure S4, derived and drawn in one pass.

   PART 1 re-derives the whole leave-one-target-out analysis from
   data/tm_table.csv — the primary source — and asserts that it agrees with
   data/loto.json, which analysis/loto_lengths.py writes from the same file by a
   separate implementation. Two independent implementations agreeing is the point:
   the Spearman coefficients here are computed from scratch, not imported.

   PART 2 draws it.

   What the panel now separates, and the old one did not:

     in sample      13 of 13 best lengths inside the published 8-11 nt window.
                    The manuscript derives 8-11 as "the narrowest window retaining
                    every target", so this count is what the window was selected to
                    achieve. Reported, and labelled for what it is.
     out of sample  every best length within 2 nt of an optimum re-derived from the
                    other twelve alone; and 12 of 13 inside the window those other
                    twelve alone support. The exception is OsODEV-T1, the site the
                    manuscript already names as setting the upper bound.
     out of sample  the per-target ranking correlation, panel B.

     node analysis/build_figureS4_editable.js  ->  FigureS4_editable.pptx
   ═══════════════════════════════════════════════════════════════════════════ */
const pptxgen = require('pptxgenjs'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* ══ PART 1 — derive ══════════════════════════════════════════════════════ */
const D = (() => {
  const splitCsv = l => { const o=[]; let c='', q=false;
    for (let i=0;i<l.length;i++){ const ch=l[i];
      if (ch === '"') { if (q && l[i+1] === '"') { c+='"'; i++; } else q = !q; }
      else if (ch === ',' && !q) { o.push(c); c=''; } else c += ch; }
    o.push(c); return o; };
  const t = fs.readFileSync(path.join(ROOT,'data','tm_table.csv'),'utf8')
              .replace(/^﻿/,'').trim().split(/\r?\n/);
  const h = splitCsv(t[0]);
  const all = t.slice(1).map(l => { const c = splitCsv(l), o = {}; h.forEach((k,i)=>o[k]=c[i]); return o; })
                .filter(r => r.efficiency && r.efficiency.trim());

  // One design (OsODEV-T1 at 5 nt) carries a status saying it is retained as recovered
  // data but not analysed. Honour that here. The recorded loto.json did not, which is
  // the error this rebuild found.
  const OK = all.filter(r => r.status === 'OK');
  const dropped = all.filter(r => r.status !== 'OK')
                     .map(r => ({target:r.target_id, len:+r.pbs_length, why:r.status}));

  const by = {};
  OK.forEach(r => (by[r.target_id] = by[r.target_id] || []).push({L:+r.pbs_length, e:+r.efficiency}));
  Object.values(by).forEach(v => v.sort((a,b) => a.L - b.L));

  const lengths = [...new Set(OK.map(r => +r.pbs_length))].sort((a,b) => a-b);
  const NL = lengths.length;
  const WIN = [8, 11];                       // the window the manuscript publishes
  const MIN_ARGMAX = 3, MIN_RANK = 4;

  const median = a => { const s=[...a].sort((x,y)=>x-y), m=s.length>>1;
                        return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
  const ranks = a => { const o = a.map((_,i)=>i).sort((i,j)=>a[i]-a[j]); const r = new Array(a.length);
    for (let i=0;i<o.length;) { let j=i; while (j+1<o.length && a[o[j+1]]===a[o[i]]) j++;
      const avg=(i+j)/2+1; for (let k=i;k<=j;k++) r[o[k]]=avg; i=j+1; } return r; };
  const pearson = (x,y) => { const n=x.length, mx=x.reduce((a,b)=>a+b,0)/n, my=y.reduce((a,b)=>a+b,0)/n;
    let num=0, dx=0, dy=0;
    for (let i=0;i<n;i++){ num+=(x[i]-mx)*(y[i]-my); dx+=(x[i]-mx)**2; dy+=(y[i]-my)**2; }
    return num/Math.sqrt(dx*dy); };
  const spearman = (x,y) => pearson(ranks(x), ranks(y));

  const names = Object.keys(by).sort();
  const argmaxNames = names.filter(t => by[t].length >= MIN_ARGMAX);
  const tooFew = names.filter(t => by[t].length < MIN_ARGMAX);
  const best = {};
  argmaxNames.forEach(t => { best[t] = by[t].reduce((a,b) => b.e > a.e ? b : a).L; });

  const rows = argmaxNames.map(t => {
    const others = argmaxNames.filter(u => u !== t).map(u => best[u]);
    const opt = Math.ceil(median(others));                 // leave-one-out optimum
    const lw  = [Math.min(...others), Math.max(...others)]; // leave-one-out window
    const v   = by[t];
    const counted = v.length >= MIN_RANK;
    const rho = spearman(v.map(p => -Math.abs(p.L - opt)), v.map(p => p.e));
    return {t, best:best[t], opt, lw, n:v.length, counted, rho,
            lens: v.map(p => p.L),
            insideWin:  best[t] >= WIN[0] && best[t] <= WIN[1],
            insideLoto: best[t] >= lw[0]  && best[t] <= lw[1],
            dev: Math.abs(best[t] - opt)};
  });

  // ── the three tests, each with its uniform-draw baseline ──────────────────
  const N = rows.length;
  const pFixed = Math.pow((WIN[1]-WIN[0]+1)/NL, N);
  const pWithin2 = Math.exp(rows.reduce((a,r) =>
    a + Math.log(lengths.filter(L => Math.abs(L - r.opt) <= 2).length / NL), 0));
  // Poisson-binomial tail: each fold has its own window and so its own probability
  const ps = rows.map(r => lengths.filter(L => L >= r.lw[0] && L <= r.lw[1]).length / NL);
  let dist = [1];
  ps.forEach(p => { const nx = new Array(dist.length+1).fill(0);
    dist.forEach((w,k) => { nx[k] += w*(1-p); nx[k+1] += w*p; }); dist = nx; });
  const kLoto = rows.filter(r => r.insideLoto).length;
  const pLoto = dist.slice(kLoto).reduce((a,b) => a+b, 0);

  // The uniform baseline above draws from all 12 lengths anyone tested, but no target was
  // tested at all 12 — several offer only one length inside the window (the ticks drawn on
  // each row). Conditioning each target on the lengths it was actually tested at is the
  // stricter and more honest null, so it is computed alongside.
  const condProd = pick => rows.reduce((a,r) => a * r.lens.filter(L => pick(r,L)).length / r.n, 1);
  const cFixed   = condProd((r,L) => L >= WIN[0] && L <= WIN[1]);
  const cWithin2 = condProd((r,L) => Math.abs(L - r.opt) <= 2);
  const cps = rows.map(r => r.lens.filter(L => L >= r.lw[0] && L <= r.lw[1]).length / r.n);
  let cdist = [1];
  cps.forEach(p => { const nx = new Array(cdist.length+1).fill(0);
    cdist.forEach((w,k) => { nx[k] += w*(1-p); nx[k+1] += w*p; }); cdist = nx; });
  const cLoto = cdist.slice(rows.filter(r => r.insideLoto).length).reduce((a,b) => a+b, 0);

  const counted = rows.filter(r => r.counted);
  const medRho = median(counted.map(r => r.rho));
  const nPos = counted.filter(r => r.rho > 0).length;
  const signP = nPos === counted.length ? Math.pow(0.5, counted.length) : null;

  /* ── cross-check against the file analysis/loto_lengths.py writes ───────── */
  const ref = JSON.parse(fs.readFileSync(path.join(ROOT,'data','loto.json'),'utf8'));
  const eq = (a,b,tol) => Math.abs(a-b) <= (tol === undefined ? 0 : tol);
  const refArg = new Map(ref.argmax.map(a => [a[0], a]));
  rows.forEach(r => {
    const a = refArg.get(r.t);
    if (!a) throw new Error(`${r.t} is in the recomputation but not in data/loto.json`);
    if (a[1] !== r.best || a[2] !== r.opt || a[3] !== r.n)
      throw new Error(`${r.t}: argmax ${[r.best,r.opt,r.n]} != loto.json ${a.slice(1)}`);
  });
  if (refArg.size !== rows.length)
    throw new Error(`argmax rows ${rows.length} != loto.json ${refArg.size}`);
  const refRank = new Map(ref.ranking.map(a => [a[0], a]));
  counted.forEach(r => {
    const a = refRank.get(r.t);
    if (!a) throw new Error(`${r.t} is counted here but absent from loto.json ranking`);
    if (!eq(a[1], r.rho, 1e-12)) throw new Error(`${r.t}: rho ${r.rho} != loto.json ${a[1]}`);
  });
  if (refRank.size !== counted.length)
    throw new Error(`ranking rows ${counted.length} != loto.json ${refRank.size}`);

  const out = {rows, lengths, NL, WIN, N, pFixed, pWithin2, pLoto, kLoto, cFixed, cWithin2, cLoto,
    maxDev: Math.max(...rows.map(r => r.dev)),
    kFixed: rows.filter(r => r.insideWin).length,
    counted, medRho, nPos, signP, tooFew, dropped,
    outsideLoto: rows.filter(r => !r.insideLoto).map(r => r.t)};
  console.log(`cohort   ${names.length} targets with measurements, ${N} with >= ${MIN_ARGMAX} analysed lengths` +
              `, ${counted.length} with >= ${MIN_RANK}; lengths ${lengths[0]}-${lengths[NL-1]} nt (${NL} distinct)`);
  console.log(`dropped  ${dropped.map(d => `${d.target} @${d.len} nt`).join(', ') || 'none'}` +
              `; too few lengths: ${tooFew.join(', ') || 'none'}`);
  console.log(`in  sample  ${out.kFixed}/${N} inside ${WIN[0]}-${WIN[1]} nt      P = ${pFixed.toExponential(1)}`);
  console.log(`out sample  ${N}/${N} within ${out.maxDev} nt of their own optimum  P = ${pWithin2.toExponential(1)}`);
  console.log(`out sample  ${kLoto}/${N} inside their own window          P = ${pLoto.toExponential(1)}` +
              `  outside: ${out.outsideLoto.join(', ') || 'none'}`);
  console.log(`ranking     median rho ${medRho.toFixed(4)}, ${nPos}/${counted.length} positive,` +
              ` pooled n ${counted.reduce((a,r)=>a+r.n,0)}, one-sided sign P = ${signP.toExponential(1)}`);
  console.log(`conditional on the lengths each target was actually tested at:` +
              ` ${cFixed.toExponential(1)} / ${cWithin2.toExponential(1)} / ${cLoto.toExponential(1)}`);
  console.log('cross-check against data/loto.json: every argmax row and every rho agrees');
  return out;
})();

/* ══ PART 2 — draw ════════════════════════════════════════════════════════ */
const C = {
  ink:'1A1A1A', mid:'4A4A4A', soft:'8A8A8A', rule:'C9CDD2', hair:'ECEEF0', zebra:'FAFBFC',
  blue:'0072B2', green:'009E73', verm:'D55E00', amber:'E69F00', purple:'CC79A7',
  band:'E4F3ED', open:'F2F4F5'
};
const F = 'Arial';
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.author = 'Plant Prime Editor';
pres.title  = 'Supplementary Figure S4 — leave-one-target-out validation of the PBS window';
const s = pres.addSlide(); s.background = {color:'FFFFFF'};

const BOXES = [];
const T = (o,x,y,w,h,op={}) => {
  const txt = (typeof o === 'string') ? o : o.map(r => r.text).join('');
  const pt  = (typeof o === 'string') ? 8 : Math.max(...o.map(r => (r.options && r.options.fontSize) || 8));
  const bold = (typeof o !== 'string') && o.some(r => r.options && r.options.bold);
  BOXES.push({x,y,w,h,txt,pt,bold});
  return s.addText(o, Object.assign({x,y,w,h,isTextBox:true,margin:0,fontFace:F,color:C.ink,valign:'top'}, op));
};
const LN = (x1,y1,x2,y2,col,wpt,dash) => s.addShape(pres.ShapeType.line,{
  x:Math.min(x1,x2), y:Math.min(y1,y2), w:Math.abs(x2-x1), h:Math.abs(y2-y1),
  line:Object.assign({color:col,width:wpt}, dash?{dashType:dash}:{}), flipH:x2<x1, flipV:y2<y1});
const R = (x,y,w,h,fill,lineCol,lineW,rad) => s.addShape(rad ? pres.ShapeType.roundRect : pres.ShapeType.rect,
  Object.assign({x,y,w,h,
    fill: fill ? {color:fill} : {type:'none'},
    line: lineCol ? {color:lineCol, width:lineW===undefined?0.75:lineW} : {type:'none'}},
    rad ? {rectRadius:rad} : {}));
const DOT = (cx,cy,d,fill,lineCol,lineW) => s.addShape(pres.ShapeType.ellipse,
  {x:cx-d/2, y:cy-d/2, w:d, h:d, fill: fill ? {color:fill} : {type:'none'},
   line: lineCol ? {color:lineCol, width:lineW===undefined?0.7:lineW} : {type:'none'}});

const AW = {' ':0.278,'.':0.278,',':0.278,'·':0.333,'/':0.278,'(':0.333,')':0.333,'-':0.333,"'":0.191,
  '–':0.556,'—':1.000,'−':0.584,'+':0.584,'×':0.584,'≥':0.549,'≤':0.549,'≈':0.549,'=':0.584,'%':0.889,
  '→':0.838,'←':0.838,'[':0.278,']':0.278,'{':0.334,'}':0.334,'Δ':0.667,'°':0.400,':':0.278,'′':0.191,
  '’':0.191,'‘':0.191,'“':0.355,'”':0.355,'<':0.584,'>':0.584,'ρ':0.556,'σ':0.556,'∈':0.549,'⁻':0.333,
  '⁵':0.333,'⁷':0.333,'³':0.333,'¹':0.333,'…':1.000};
function adv(ch){
  if (AW[ch] !== undefined) return AW[ch];
  if (ch >= '0' && ch <= '9') return 0.556;
  if (ch >= 'a' && ch <= 'z') return 'ijl'.includes(ch)?0.222 : 'ft'.includes(ch)?0.278 : 'mw'.includes(ch)?0.836 : 0.556;
  if (ch >= 'A' && ch <= 'Z') return 'IJ'.includes(ch)?0.290 : 'MW'.includes(ch)?0.870 : 0.690;
  return 0.620;
}
const widthIn = (t,pt,bold) => [...t].reduce((a,c)=>a+adv(c),0)*(bold?1.05:1)*pt/72;

/* ── shared row grid: both panels carry the same 13 targets on the same rows ── */
const PY = 1.52, PH = 3.88, ROW = PH / D.N;          // 13 rows
const rowY = i => PY + ROW*i;
const rowC = i => PY + ROW*(i + 0.5);

function frame(x0, nameW, plotX, plotW, letter, title, sub) {
  T([{text:letter, options:{fontSize:14, bold:true}}], x0, 1.00, 0.24, 0.26);
  T([{text:title, options:{fontSize:10.5, bold:true}}], x0+0.26, 1.00, plotX+plotW-x0-0.26, 0.19);
  T([{text:sub, options:{fontSize:7.8, color:C.mid}}], x0+0.26, 1.195, plotX+plotW-x0-0.26, 0.14);
  T([{text:'n', options:{fontSize:6.8, color:C.soft, bold:true}}],
    plotX-0.32, PY-0.16, 0.26, 0.13, {align:'right'});
  for (let i=0;i<D.N;i++) if (i%2===0) R(plotX, rowY(i), plotW, ROW, C.zebra, null, 0);
}

/* ══ PANEL A ══════════════════════════════════════════════════════════════ */
{
  const x0 = 0.55, NW = 1.05, px = 1.95, pw = 4.50;
  const LO = D.lengths[0], HI = D.lengths[D.NL-1];
  const xv = v => px + (v - LO)/(HI - LO)*pw;

  frame(x0, NW, px, pw, 'A',
    'Best measured length against an optimum re-derived without that target',
    'one target per row; the capped bar is the window the other twelve targets alone support');

  // the published window, behind everything
  R(xv(D.WIN[0]-0.5), PY, xv(D.WIN[1]+0.5)-xv(D.WIN[0]-0.5), PH, C.band, null, 0);
  T([{text:`published window ${D.WIN[0]}–${D.WIN[1]} nt`, options:{fontSize:7.2, bold:true, color:C.green}}],
    (xv(D.WIN[0]-0.5)+xv(D.WIN[1]+0.5))/2 - 1.00, PY-0.16, 2.00, 0.13, {align:'center'});

  for (let v=LO; v<=HI; v++) if (v%2===0) LN(xv(v), PY, xv(v), PY+PH, C.hair, 0.5);

  const rows = [...D.rows].sort((a,b) => a.best - b.best || a.t.localeCompare(b.t));
  rows.forEach((r,i) => {
    const cy = rowC(i);
    T([{text:r.t, options:{fontSize:7.4}}], x0, cy-0.075, NW, 0.15, {align:'right'});
    T([{text:String(r.n), options:{fontSize:6.8, color:C.soft}}], px-0.32, cy-0.07, 0.26, 0.14, {align:'right'});
    // the lengths actually tested at this target — without them a reader cannot tell
    // whether landing inside the window was a choice or a constraint
    r.lens.forEach(L => LN(xv(L), cy+0.070, xv(L), cy+0.130, C.soft, 0.8));
    // the window the OTHER twelve targets alone support
    LN(xv(r.lw[0]), cy, xv(r.lw[1]), cy, C.rule, 1.1);
    LN(xv(r.lw[0]), cy-0.045, xv(r.lw[0]), cy+0.045, C.soft, 1.0);
    LN(xv(r.lw[1]), cy-0.045, xv(r.lw[1]), cy+0.045, C.soft, 1.0);
    // the optimum those twelve alone give, and the best this target actually measured
    LN(xv(r.opt), cy-0.075, xv(r.opt), cy+0.075, C.ink, 1.6);
    DOT(xv(r.best), cy, 0.105, r.insideLoto ? C.green : C.verm, 'FFFFFF', 0.7);
  });

  for (let v=LO; v<=HI; v++) if (v%2===0) {
    T([{text:String(v), options:{fontSize:7.6, color:C.mid}}], xv(v)-0.16, PY+PH+0.05, 0.32, 0.15, {align:'center'});
  }
  LN(px, PY+PH, px+pw, PY+PH, C.ink, 0.9);
  T([{text:'primer-binding-site length (nt)', options:{fontSize:8.4}}], px, PY+PH+0.24, pw, 0.17, {align:'center'});

  // key
  const KY = PY+PH+0.50;
  DOT(x0+0.09, KY+0.07, 0.105, C.green, 'FFFFFF', 0.7);
  T([{text:'best measured length', options:{fontSize:7.4}}], x0+0.19, KY, 1.18, 0.14);
  LN(x0+1.45, KY+0.005, x0+1.45, KY+0.135, C.ink, 1.6);
  T([{text:'leave-one-out optimum', options:{fontSize:7.4}}], x0+1.52, KY, 1.30, 0.14);
  LN(x0+2.90, KY+0.07, x0+3.24, KY+0.07, C.rule, 1.1);
  LN(x0+2.90, KY+0.025, x0+2.90, KY+0.115, C.soft, 1.0);
  LN(x0+3.24, KY+0.025, x0+3.24, KY+0.115, C.soft, 1.0);
  T([{text:'leave-one-out window', options:{fontSize:7.4}}], x0+3.31, KY, 1.26, 0.14);
  [0, 0.09, 0.18].forEach(d => LN(x0+4.66+d, KY+0.025, x0+4.66+d, KY+0.125, C.soft, 0.8));
  T([{text:'lengths tested', options:{fontSize:7.4}}], x0+4.93, KY, 0.90, 0.14);
}

/* ══ PANEL B ══════════════════════════════════════════════════════════════ */
{
  const x1 = 6.92, NW = 1.05, bx = 8.32, bw = 3.74;
  const rx = v => bx + v*bw;

  frame(x1, NW, bx, bw, 'B',
    'Out-of-sample Spearman correlation, per target',
    'measured efficiency ranked against proximity to an optimum this target did not contribute to');

  [0, 0.25, 0.5, 0.75, 1].forEach(v => LN(rx(v), PY, rx(v), PY+PH, C.hair, 0.5));

  const rows = [...D.rows].sort((a,b) => (b.counted - a.counted) || (b.rho - a.rho));
  rows.forEach((r,i) => {
    const cy = rowC(i);
    T([{text:r.t, options:{fontSize:7.4, color:r.counted ? C.ink : C.soft}}],
      x1, cy-0.075, NW, 0.15, {align:'right'});
    T([{text:String(r.n), options:{fontSize:6.8, color:C.soft}}], bx-0.32, cy-0.07, 0.26, 0.14, {align:'right'});
    const w = Math.max(0.006, rx(r.rho) - bx);
    R(bx, cy-0.068, w, 0.136, r.counted ? C.green : C.rule, null, 0);
    // values in a fixed column, not at the end of each bar: at the end they collide with
    // the median rule wherever a target's rho happens to land near it
    T([{text:r.rho.toFixed(2), options:{fontSize:7, color:r.counted ? C.ink : C.soft}}],
      bx+bw+0.07, cy-0.075, 0.36, 0.15);
  });

  LN(rx(D.medRho), PY, rx(D.medRho), PY+PH, C.green, 1.3, 'dash');

  [0, 0.25, 0.5, 0.75, 1].forEach(v => {
    T([{text:String(v), options:{fontSize:7.6, color:C.mid}}], rx(v)-0.20, PY+PH+0.05, 0.40, 0.15, {align:'center'});
  });
  LN(bx, PY+PH, bx+bw, PY+PH, C.ink, 0.9);
  T([{text:'Spearman ρ, out of sample', options:{fontSize:8.4}}], bx, PY+PH+0.24, bw, 0.17, {align:'center'});

  const KY = PY+PH+0.50;
  R(x1+0.02, KY+0.02, 0.20, 0.11, C.green, null, 0);
  T([{text:'counted', options:{fontSize:7.4}}], x1+0.28, KY, 0.55, 0.14);
  R(x1+0.90, KY+0.02, 0.20, 0.11, C.rule, null, 0);
  T([{text:'three lengths only — shown, not counted', options:{fontSize:7.4}}], x1+1.16, KY, 2.20, 0.14);
  LN(x1+3.46, KY+0.005, x1+3.46, KY+0.135, C.green, 1.3, 'dash');
  T([{text:`median ρ = ${D.medRho.toFixed(2)}`, options:{fontSize:7.4}}], x1+3.53, KY, 1.10, 0.14);
}

/* ══ footnotes, title, footer ═════════════════════════════════════════════ */
// one significant figure, renormalised: 9.8e-4 must print as 1 × 10⁻³, not 10 × 10⁻⁴
const P = p => {
  let e = Math.floor(Math.log10(p)), m = Math.round(p / Math.pow(10, e));
  if (m === 10) { m = 1; e += 1; }
  const sup = String(e).replace('-','−').replace(/[0-9]/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
  return `${m} × 10${sup}`;
};
{
  const FY = 6.16;
  T([{text:`${D.kFixed} of ${D.N} best lengths fall inside the published ${D.WIN[0]}–${D.WIN[1]} nt window — but the manuscript derives ${D.WIN[0]}–${D.WIN[1]} nt as `,
      options:{fontSize:7.2, color:C.mid}},
     {text:'the narrowest window retaining every target', options:{fontSize:7.2, bold:true, color:C.ink}},
     {text:`, so that count is what the selection rule was chosen to produce and not a test of it. The out-of-sample statements are the two drawn on every row: each best length lies within ${D.maxDev} nt of an optimum it did not contribute to, and ${D.kLoto} of ${D.N} fall inside the window the other twelve alone support — the exception, ${D.outsideLoto.join(', ')}, being the site the text already names as setting the upper bound. The three counts give P = ${P(D.pFixed)}, ${P(D.pWithin2)} and ${P(D.pLoto)} against a uniform draw over the ${D.NL} lengths tested, and ${P(D.cFixed)}, ${P(D.cWithin2)} and ${P(D.cLoto)} conditioning each target on the lengths it was actually tested at, which are the ticks on its own row.`,
      options:{fontSize:7.2, color:C.mid}}], 0.55, FY, 5.90, 0.92, {lineSpacing:9.3});

  T([{text:`Positive at all ${D.counted.length} targets with four or more analysed lengths; median ρ = ${D.medRho.toFixed(2)}, one-sided sign test P = ${P(D.signP)}. The three targets with only three lengths are drawn in grey and left out of the statistics — n = 3 admits only ρ in {−1, −0.5, +0.5, +1}. ${D.tooFew.join(', ')} carries a single measurement and so has no best length to predict. One design, ${D.dropped.map(d => `${d.target} at ${d.len} nt`).join(' and ')}, is marked in tm_table.csv as recovered but not analysed and is excluded here; the previously recorded loto.json counted it, which is what put an eleventh target in this panel.`,
      options:{fontSize:7.2, color:C.mid}}], 6.92, FY, 5.90, 0.92, {lineSpacing:9.3});
}

T([{text:'Supplementary Figure S4.  ', options:{fontSize:13.5, bold:true}},
   {text:'Leave-one-target-out validation of the 8–11 nt primer-binding-site window',
    options:{fontSize:13.5}}], 0.55, 0.24, 12.4, 0.28);
T([{text:'Every value is re-derived from data/tm_table.csv by the script that draws the figure, and cross-checked against data/loto.json, which analysis/loto_lengths.py writes from the same file.',
   options:{fontSize:9.5, color:C.mid}}], 0.55, 0.57, 12.4, 0.22);
T([{text:'Plant Prime Editor v1.0 · regenerated by analysis/build_figureS4_editable.js · every element is a native, editable PowerPoint object',
   options:{fontSize:8, color:'AAAAAA'}}], 0.55, 7.20, 12.4, 0.18);
s.addNotes('Supplementary Figure S4. Leave-one-target-out validation of the 8-11 nt primer-binding-site window. '
 + '(A) For each of the 13 rice targets with three or more analysed primer-binding-site lengths, the length that gave '
 + 'the highest measured efficiency (filled circle) against two quantities re-derived from the other twelve targets '
 + 'alone: the optimum (black tick) and the narrowest window retaining all of them (capped grey bar). Ticks below each '
 + 'row mark the lengths actually tested there. All 13 best lengths lie within 2 nt of their own leave-one-out optimum '
 + 'and 12 of 13 inside their own leave-one-out window; the exception is OsODEV-T1, the site that sets the upper bound '
 + 'of the published window. The shaded band is the published 8-11 nt window, which all 13 fall inside - a description '
 + 'of a window selected as the narrowest one retaining every target, not an out-of-sample test of it. '
 + '(B) Spearman correlation between measured efficiency and proximity to the withheld optimum, per target. Positive at '
 + 'all 10 targets with four or more analysed lengths; median +0.74, one-sided sign test P = 1e-3. Three targets with '
 + 'only three lengths are drawn open and excluded from the statistics. OsIPA1-T1 has one measurement and is absent from '
 + 'both panels.');

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
  const need = widthIn(p.txt, p.pt, p.bold);
  if (need > p.w*(lines===1?1:lines*0.93) + 0.004) { bad++;
    console.log(`OVERFLOW "${p.txt.slice(0,40)}"  needs ${need.toFixed(2)}, box ${p.w.toFixed(2)} x ${lines} line(s)`); }
});
console.log(bad===0 ? `layout audit: ${BOXES.length} text boxes, no overlaps, no overflow, nothing off-slide`
                    : `layout audit: ${bad} problem(s)`);
pres.writeFile({fileName: 'FigureS4_editable.pptx'}).then(f => console.log('written', f));
