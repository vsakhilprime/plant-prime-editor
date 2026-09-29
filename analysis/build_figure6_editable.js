#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — Figure 6, derived and drawn in one pass.

   PART 1 reads data/pridict_vs_measured.json — the same file
   verify_manuscript_numbers.py reads — and derives every value the figure
   shows; PART 2 draws it as native PowerPoint shapes. Nothing is transcribed.

   THE NORMALISATION IS THE WHOLE FIGURE. Measured efficiency is expressed as a
   fraction of the best pegRNA at that same target. Pooled raw efficiency gives
   a correlation of the opposite sign, because between-target differences in
   absolute editability swamp the within-target trend the figure is about; both
   numbers are computed here and both are printed, so a reader cannot mistake
   one for the other.

   PANEL A is not the same quantity as Figure 5A. Figure 5A is the length
   PRIDICT's designer returns when you submit a sequence. Panel A here is which
   of the PUBLISHED lengths at that target PRIDICT scores highest. The two
   differ at three of the four shared targets, and the legend must say so.

   No box sits inside panel B's axes: every quadrant of that scatter is
   occupied, so an inset would either cover data or need a fill that hides it.
   The statistics go under the panel title instead.

     node analysis/build_figure6_editable.js  ->  Figure6_AB_editable.pptx
   ═══════════════════════════════════════════════════════════════════════════ */
const pptxgen = require('pptxgenjs'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* ══ PART 1 — derive ══════════════════════════════════════════════════════ */
const D = (() => {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT,'data','pridict_vs_measured.json'),'utf8'));
  const targets = [...new Set(raw.map(r => r.target))];
  const by = Object.fromEntries(targets.map(t => [t, raw.filter(r => r.target === t)]));
  // within-target normalisation, exactly as the panel B legend states
  const rows = raw.map(r => {
    const mx = Math.max(...by[r.target].map(x => x.eff));
    return Object.assign({}, r, {effNorm: mx ? r.eff/mx : null});
  });

  const rank = a => { const s = a.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]);
    const r = new Array(a.length);
    for (let i=0;i<s.length;) { let j=i; while (j+1<s.length && s[j+1][0]===s[i][0]) j++;
      const avg = (i+j)/2 + 1; for (let k=i;k<=j;k++) r[s[k][1]] = avg; i = j+1; } return r; };
  const pearson = (a,b) => { const n=a.length, ma=a.reduce((s,v)=>s+v,0)/n, mb=b.reduce((s,v)=>s+v,0)/n;
    let sab=0,sa=0,sb=0; for (let i=0;i<n;i++){const da=a[i]-ma, db=b[i]-mb; sab+=da*db; sa+=da*da; sb+=db*db;}
    return sab/Math.sqrt(sa*sb); };
  const spearman = (a,b) => pearson(rank(a), rank(b));
  // two-sided P from the t approximation on n-2 df, which is what scipy.stats.spearmanr
  // uses for n > 8; incomplete beta by continued fraction
  const betacf = (a,b,x) => { let qab=a+b, qap=a+1, qam=a-1, c=1, d=1-qab*x/qap;
    if (Math.abs(d)<1e-30) d=1e-30; d=1/d; let h=d;
    for (let m=1;m<=200;m++){ const m2=2*m;
      let aa=m*(b-m)*x/((qam+m2)*(a+m2));
      d=1+aa*d; if(Math.abs(d)<1e-30) d=1e-30; c=1+aa/c; if(Math.abs(c)<1e-30) c=1e-30; d=1/d; h*=d*c;
      aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
      d=1+aa*d; if(Math.abs(d)<1e-30) d=1e-30; c=1+aa/c; if(Math.abs(c)<1e-30) c=1e-30; d=1/d;
      const del=d*c; h*=del; if(Math.abs(del-1)<3e-12) break; }
    return h; };
  const lgamma = z => { const g=[76.18009172947146,-86.50532032941677,24.01409824083091,
    -1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
    let x=z, y=z, tmp=x+5.5; tmp-=(x+0.5)*Math.log(tmp); let ser=1.000000000190015;
    for (let j=0;j<6;j++) ser+=g[j]/++y; return -tmp+Math.log(2.5066282746310005*ser/x); };
  const betai = (a,b,x) => { if (x<=0) return 0; if (x>=1) return 1;
    const bt = Math.exp(lgamma(a+b)-lgamma(a)-lgamma(b)+a*Math.log(x)+b*Math.log(1-x));
    return x < (a+1)/(a+b+2) ? bt*betacf(a,b,x)/a : 1-bt*betacf(b,a,1-x)/b; };
  const pFromR = (r,n) => { const df=n-2, t2=r*r*df/(1-r*r); return betai(df/2, 0.5, df/(df+t2)); };

  const hek = rows.map(r => r.hek), k562 = rows.map(r => r.k562);
  const eN  = rows.map(r => r.effNorm), eRaw = rows.map(r => r.eff);
  const rhoN = spearman(hek, eN), rhoRaw = spearman(hek, eRaw), rhoModels = spearman(hek, k562);
  const n = rows.length;

  // least-squares fit through the normalised points, for the dashed line in B
  const mx = hek.reduce((s,v)=>s+v,0)/n, my = eN.reduce((s,v)=>s+v,0)/n;
  let sxy=0, sxx=0; for (let i=0;i<n;i++){ sxy+=(hek[i]-mx)*(eN[i]-my); sxx+=(hek[i]-mx)**2; }
  const slope = sxy/sxx, intercept = my - slope*mx;

  const A = targets.map(t => {
    const g = by[t];
    return {target:t,
      pridictBest: g.reduce((a,b) => b.hek > a.hek ? b : a).pbs,
      measuredBest: g.reduce((a,b) => b.eff > a.eff ? b : a).pbs,
      tested: g.map(r => r.pbs).sort((a,b)=>a-b)};
  });
  const band = [8,11];
  return {targets, rows, A, band, n,
    stats:{rhoNorm:rhoN, pNorm:pFromR(rhoN,n), rhoRaw:rhoRaw, pRaw:pFromR(rhoRaw,n),
           rhoModels:rhoModels, slope, intercept},
    hitsA:{pridict:A.filter(a => a.pridictBest>=band[0] && a.pridictBest<=band[1]).length,
           measured:A.filter(a => a.measuredBest>=band[0] && a.measuredBest<=band[1]).length,
           n:A.length}};
})();

/* ══ PART 2 — draw ════════════════════════════════════════════════════════ */
const C = {
  ink:'1A1A1A', mid:'4A4A4A', soft:'8A8A8A', rule:'C9CDD2', hair:'E8EAEC', grey:'F4F5F6',
  axis:'333333', grid:'E8EAEC',
  blue:'0072B2', green:'009E73', verm:'D55E00', amber:'E69F00', purple:'CC79A7', sky:'56B4E9',
  greenband:'D6EFE6', measured:'333333'
};
const F = 'Arial';
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.author = 'Plant Prime Editor';
pres.title  = 'Figure 6 — A mammalian-trained predictor does not transfer to plant prime editing';
const s = pres.addSlide(); s.background = {color:'FFFFFF'};

const BOXES = [];
const T = (o,x,y,w,h,op={}) => {
  const txt = (typeof o === 'string') ? o : o.map(r => r.text).join('');
  const pt  = (typeof o === 'string') ? 8 : Math.max(...o.map(r => (r.options && r.options.fontSize) || 8));
  const bold = (typeof o !== 'string') && o.some(r => r.options && r.options.bold);
  const rot = !!op.rotate, bh = pt*1.30/72;
  BOXES.push(Object.assign(rot ? {x:(x+w/2)-bh/2, y:(y+h/2)-w/2, w:bh, h:w} : {x,y,w,h}, {txt,pt,bold,rot}));
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
const DOT = (cx,cy,d,col) => s.addShape(pres.ShapeType.ellipse,
  {x:cx-d/2, y:cy-d/2, w:d, h:d, fill:{color:col}, line:{color:'FFFFFF', width:0.5}});
const AW = {' ':0.278,'.':0.278,',':0.278,'·':0.333,'/':0.278,'(':0.333,')':0.333,'-':0.333,"'":0.191,
  '–':0.556,'—':1.000,'−':0.584,'+':0.584,'×':0.584,'≥':0.549,'≈':0.549,'=':0.584,'%':0.889,
  'ρ':0.556,'Δ':0.667,'°':0.400,':':0.278,'′':0.191,'’':0.191,'²':0.333,'<':0.584};
function adv(ch){
  if (AW[ch] !== undefined) return AW[ch];
  if (ch >= '0' && ch <= '9') return 0.556;
  if (ch >= 'a' && ch <= 'z') return 'ijl'.includes(ch)?0.222 : 'ft'.includes(ch)?0.278 : 'mw'.includes(ch)?0.836 : 0.556;
  if (ch >= 'A' && ch <= 'Z') return 'IJ'.includes(ch)?0.290 : 'MW'.includes(ch)?0.870 : 0.690;
  return 0.620;
}
const widthIn = (t,pt,bold) => [...t].reduce((a,c)=>a+adv(c),0)*(bold?1.05:1)*pt/72;
const TC = [C.blue, C.green, C.verm, C.amber];
const tcol = t => TC[D.targets.indexOf(t) % TC.length];
const sig = (v,d) => (v<0?'−':'+') + Math.abs(v).toFixed(d);
const pTxt = p => p < 0.001 ? 'P < 0.001' : 'P = ' + p.toFixed(3);

const PY = 1.90, PH = 3.42;

/* ══ A — the length PRIDICT picks against the length that won ═════════════ */
{
  const px = 0.55, pw = 5.72, x0 = px + 0.66, pwid = pw - 0.72, y1 = PY + PH;
  T([{text:'A', options:{fontSize:15, bold:true}}], px, 1.02, 0.28, 0.28);
  T([{text:'PRIDICT2.0 picks a longer primer-binding site than the one that won',
     options:{fontSize:11, bold:true}}], px+0.30, 1.05, pw, 0.22);
  T([{text:'the length PRIDICT scores highest against the length that gave the highest measured efficiency',
     options:{fontSize:7.5, color:C.mid}}], px+0.30, 1.27, pw+0.10, 0.16);
  T([{text:'a choice among the published lengths at that target — not what PRIDICT’s own designer returns (Figure 5A)',
     options:{fontSize:7.5, color:C.soft, italic:true}}], px+0.30, 1.44, pw+0.10, 0.16);

  const yd = [0,16], yticks = [0,4,8,12,16];
  const sy = v => y1 - (v-yd[0])/(yd[1]-yd[0])*PH;
  R(x0, sy(D.band[1]), pwid, sy(D.band[0])-sy(D.band[1]), C.greenband, null, 0);
  yticks.forEach(v => LN(x0, sy(v), x0+pwid, sy(v), C.grid, 0.75));
  const gw = pwid/D.A.length, bw = gw*0.30;
  D.A.forEach((a,i) => {
    const gx = x0 + i*gw;
    if (i) LN(gx, PY, gx, y1, C.hair, 0.6);
    // every length tested at this target, as a short rug at the left of the group:
    // the pick is made from these, and at OsAAT there are only three to pick from
    a.tested.forEach(L => LN(gx + 0.05, sy(L), gx + 0.19, sy(L), C.soft, 1.0));
    [[a.pridictBest, C.purple, 0], [a.measuredBest, C.measured, 1]].forEach(([v,col,k]) => {
      const bx = gx + gw*0.5 + (k ? 0.03 : -0.03 - bw);
      R(bx, sy(v), bw, y1 - sy(v), col, 'FFFFFF', 0.5);
      T([{text:String(v), options:{fontSize:7, bold:true, color:col}}], bx-0.10, sy(v)-0.17, bw+0.20, 0.14, {align:'center'});
    });
    T([{text:a.target, options:{fontSize:7.5, color:C.mid}}], gx, y1+0.08, gw, 0.15, {align:'center'});
    T([{text:`${a.tested.length} lengths tested`, options:{fontSize:6.5, color:C.soft}}],
      gx, y1+0.24, gw, 0.13, {align:'center'});
  });
  LN(x0, y1, x0+pwid, y1, C.axis, 1.1); LN(x0, PY, x0, y1, C.axis, 1.1);
  yticks.forEach(v => { LN(x0-0.06, sy(v), x0, sy(v), C.axis, 1.0);
    T([{text:String(v), options:{fontSize:7.5, color:C.mid}}], x0-0.46, sy(v)-0.09, 0.38, 0.17, {align:'right'}); });
  T([{text:'primer-binding-site length (nt)', options:{fontSize:8.5}}],
    (px+0.08)-PH/2, (PY+PH/2)-0.11, PH, 0.22, {align:'center', rotate:270});

  const KY = y1 + 0.50;
  [[C.purple,'length PRIDICT2.0 scores highest'], [C.measured,'length with the highest measured efficiency']]
    .forEach(([col,lab], i) => {
      const x = px + i*2.85;
      R(x, KY+0.035, 0.15, 0.10, col, null, 0);
      T([{text:lab, options:{fontSize:7.5}}], x+0.22, KY, 2.60, 0.14);
    });
  T([{text:`Shaded band, the ${D.band[0]}–${D.band[1]} nt window derived in this work. The rug at the left of each group marks every length tested there. The measured best falls inside the window at ${D.hitsA.measured} of ${D.hitsA.n} targets; PRIDICT’s pick at ${D.hitsA.pridict} of ${D.hitsA.n}.`,
     options:{fontSize:7, color:C.mid}}], px, KY+0.24, pw+0.10, 0.30, {lineSpacing:9});
}

/* ══ B — predicted score against measured efficiency ══════════════════════ */
{
  const px = 6.95, pw = 5.83, x0 = px + 0.66, pwid = pw - 0.72, y1 = PY + PH;
  T([{text:'B', options:{fontSize:15, bold:true}}], px, 1.02, 0.28, 0.28);
  T([{text:'and its score runs the wrong way against measured efficiency',
     options:{fontSize:11, bold:true}}], px+0.30, 1.05, pw, 0.22);
  T([{text:`${D.n} published pegRNAs at the same four rice targets; efficiency normalised within each target to that target’s best`,
     options:{fontSize:7.5, color:C.mid}}], px+0.30, 1.27, pw, 0.16);
  T([{text:`Spearman ρ = ${sig(D.stats.rhoNorm,2)},  ${pTxt(D.stats.pNorm)},  n = ${D.n}`,
     options:{fontSize:8, bold:true, color:C.verm}}], px+0.30, 1.44, pw, 0.16);

  const xd = [62,84], yd = [0,1.06];
  const xticks = [65,70,75,80], yticks = [0,0.25,0.50,0.75,1.00];
  const sx = v => x0 + (v-xd[0])/(xd[1]-xd[0])*pwid;
  const sy = v => y1 - (v-yd[0])/(yd[1]-yd[0])*PH;
  yticks.forEach(v => LN(x0, sy(v), x0+pwid, sy(v), C.grid, 0.75));
  xticks.forEach(v => LN(sx(v), PY, sx(v), y1, C.grid, 0.75));
  // least-squares fit, clipped to the plot box
  const fy = v => D.stats.intercept + D.stats.slope*v;
  LN(sx(xd[0]), sy(Math.min(yd[1], Math.max(yd[0], fy(xd[0])))),
     sx(xd[1]), sy(Math.min(yd[1], Math.max(yd[0], fy(xd[1])))), C.verm, 2.0, 'dash');
  D.rows.forEach(r => DOT(sx(r.hek), sy(r.effNorm), 0.105, tcol(r.target)));
  LN(x0, y1, x0+pwid, y1, C.axis, 1.1); LN(x0, PY, x0, y1, C.axis, 1.1);
  xticks.forEach(v => { LN(sx(v), y1, sx(v), y1+0.06, C.axis, 1.0);
    T([{text:String(v), options:{fontSize:7.5, color:C.mid}}], sx(v)-0.24, y1+0.10, 0.48, 0.17, {align:'center'}); });
  yticks.forEach(v => { LN(x0-0.06, sy(v), x0, sy(v), C.axis, 1.0);
    T([{text:v.toFixed(2), options:{fontSize:7.5, color:C.mid}}], x0-0.50, sy(v)-0.09, 0.42, 0.17, {align:'right'}); });
  T([{text:'PRIDICT2.0 predicted editing score (HEK293T model)', options:{fontSize:8.5}}],
    x0, y1+0.30, pwid, 0.18, {align:'center'});
  T([{text:'measured efficiency, normalised within target', options:{fontSize:8.5}}],
    (px+0.06)-PH/2, (PY+PH/2)-0.11, PH, 0.22, {align:'center', rotate:270});

  const KY = y1 + 0.50, KW = pw/D.targets.length;
  D.targets.forEach((t,i) => {
    const x = px + i*KW;
    DOT(x+0.07, KY+0.08, 0.105, tcol(t));
    T([{text:t, options:{fontSize:7.5}}], x+0.19, KY, KW-0.24, 0.14);
  });
  T([{text:`Dashed line, least-squares fit. The two PRIDICT cell-line models agree with one another (ρ = ${sig(D.stats.rhoModels,2)}), so the discrepancy reflects training domain, not noise. Normalising within target is essential: pooled raw efficiency gives ρ = ${sig(D.stats.rhoRaw,2)}, ${pTxt(D.stats.pRaw)} — the opposite sign — because differences in absolute editability between targets swamp the within-target trend.`,
     options:{fontSize:7, color:C.mid}}], px, KY+0.24, pw, 0.44, {lineSpacing:9});
}

/* ══ titles and footer ════════════════════════════════════════════════════ */
T([{text:'Figure 6.  ', options:{fontSize:13.5, bold:true}},
   {text:'A mammalian-trained efficiency predictor does not transfer to plant prime editing', options:{fontSize:13.5}}],
  0.55, 0.24, 12.4, 0.28);
T([{text:`Every value regenerates from data/pridict_vs_measured.json — the same file the manuscript verifier reads — so the figure cannot drift from the statistics the paper reports.`,
   options:{fontSize:9.5, color:C.mid}}], 0.55, 0.57, 12.4, 0.22);
T([{text:'Plant Prime Editor v1.0 · regenerated by analysis/build_figure6_editable.js · every element is a native, editable PowerPoint object',
   options:{fontSize:8, color:'AAAAAA'}}], 0.55, 7.20, 12.4, 0.18);
s.addNotes(`Figure 6A-B. A: for each of the four rice targets carrying measured efficiencies, the primer-binding-site length PRIDICT2.0 scores highest against the length that gave the highest measured efficiency; faint rules mark every length tested at that target; shaded band, the 8-11 nt window derived in this work. This is a choice among published lengths, not the design PRIDICT's own designer returns - that is Figure 5A, and the two differ at three of the four shared targets. B: PRIDICT2.0 score against measured efficiency, normalised within each target, for ${D.n} published pegRNAs. Spearman rho ${D.stats.rhoNorm.toFixed(2)}, P ${D.stats.pNorm.toFixed(3)}. Pooled raw efficiency gives the opposite sign; the normalisation is the whole figure.`);

/* ══ layout audit ═════════════════════════════════════════════════════════ */
let bad = 0;
for (let a=0; a<BOXES.length; a++) for (let b=a+1; b<BOXES.length; b++) {
  const p=BOXES[a], q=BOXES[b];
  const ox = Math.min(p.x+p.w,q.x+q.w) - Math.max(p.x,q.x);
  const oy = Math.min(p.y+p.h,q.y+q.h) - Math.max(p.y,q.y);
  if (ox > 0.004 && oy > 0.004) { bad++;
    console.log(`OVERLAP  "${p.txt.slice(0,30)}" x "${q.txt.slice(0,30)}"  ${ox.toFixed(3)}x${oy.toFixed(3)}`); }
}
BOXES.forEach(p => {
  if (p.x < 0.02 || p.x+p.w > 13.31 || p.y < 0.02 || p.y+p.h > 7.48) { bad++;
    console.log(`OFF-SLIDE "${p.txt.slice(0,34)}"  x ${p.x.toFixed(2)}..${(p.x+p.w).toFixed(2)}  y ${p.y.toFixed(2)}..${(p.y+p.h).toFixed(2)}`); }
  const run = p.rot ? p.h : p.w;
  const lines = Math.max(1, Math.floor((p.rot ? p.w : p.h)/(p.pt*1.18/72)));
  const t = p.txt.split('\n')[0];
  const need = widthIn(t, p.pt, p.bold);
  if (need > run*(lines===1?1:lines*0.93) + 0.004) { bad++;
    console.log(`OVERFLOW "${t.slice(0,42)}"  needs ${need.toFixed(2)}, box ${run.toFixed(2)} x ${lines} line(s)`); }
});
console.log(bad===0 ? `layout audit: ${BOXES.length} text boxes, no overlaps, no overflow, nothing off-slide`
                    : `layout audit: ${bad} problem(s)`);
pres.writeFile({fileName: 'Figure6_AB_editable.pptx'}).then(f => console.log('written', f));
