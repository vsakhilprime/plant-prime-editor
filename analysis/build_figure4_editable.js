const pptxgen=require('pptxgenjs'), fs=require('fs');
// FIX DATA-PATH (13 Sep 2026). This read from the CURRENT WORKING DIRECTORY while its
// writer, analysis/fit_tm_optimum.py, correctly writes analysis/fig4data.json — so the
// figure could only be built from inside analysis/, and a stray copy at the repository
// root would have been read in preference to the real one. That is how the Figure 3 data
// file came to sit at the root three hours stale, holding the pre-correction worked
// example. Reader and writer now name the same file.
const D=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fig4data.json'),'utf8'));
const C={ink:'1A1A1A',mid:'4A4A4A',soft:'8A8A8A',axis:'333333',grid:'E8EAEC',
        blue:'0072B2',verm:'D55E00',green:'009E73',orange:'E69F00',band:'F7E2D1',greenband:'D6EFE6'};
const pres=new pptxgen(); pres.layout='LAYOUT_WIDE';
pres.author='Plant Prime Editor'; pres.title='Figure 4 — PBS melting-temperature recalibration';
const s=pres.addSlide(); s.background={color:'FFFFFF'};
const F='Arial';
const BOXES=[];
const T=(o,x,y,w,h,op={})=>{
  const txt=(typeof o==='string')?o:o.map(r=>r.text).join('');
  const pt=(typeof o==='string')?8:Math.max(...o.map(r=>(r.options&&r.options.fontSize)||8));
  const bold=(typeof o!=='string')&&o.some(r=>r.options&&r.options.bold);
  // a rotated box occupies a band of one line's height centred on its own centre,
  // so it is recorded by what it actually covers, not by its unrotated rectangle
  const rot=!!op.rotate;
  const bh=pt*1.30/72;
  BOXES.push(rot ? {x:(x+w/2)-bh/2, y:(y+h/2)-w/2, w:bh, h:w, txt, pt, bold, rot}
                 : {x,y,w,h,txt,pt,bold,rot});
  return s.addText(o,Object.assign({x,y,w,h,isTextBox:true,margin:0,fontFace:F,color:C.ink,valign:'top'},op));
};
const LN=(x1,y1,x2,y2,col,wpt,dash)=>s.addShape(pres.ShapeType.line,{x:Math.min(x1,x2),y:Math.min(y1,y2),
  w:Math.abs(x2-x1),h:Math.abs(y2-y1),line:Object.assign({color:col,width:wpt},dash?{dashType:dash}:{}),
  flipH:x2<x1,flipV:y2<y1});
const DOT=(cx,cy,d,col,tr)=>s.addShape(pres.ShapeType.ellipse,{x:cx-d/2,y:cy-d/2,w:d,h:d,
  fill:{color:col,transparency:tr===undefined?45:tr},line:{color:'FFFFFF',width:0.4}});

// ── layout: wide left margin for the rotated axis title, generous gutters ─────
const PW=3.05, PH=3.70, PT=1.32;   // panel A's rotated y-title is centred at x0-0.98, so x0
const PX=[1.22, 5.48, 9.73];       // must clear 1.09 or the title runs off the slide edge
const SB=PT+PH+0.80, RS=0.215;                        // legend origin and row pitch
function axes(i,xd,yd,xlab,ylab,xticks,yticks,xfmt,yfmt){
  const x0=PX[i], y0=PT, x1=x0+PW, y1=PT+PH;
  const sx=v=>x0+(v-xd[0])/(xd[1]-xd[0])*PW;
  const sy=v=>y1-(v-yd[0])/(yd[1]-yd[0])*PH;
  yticks.forEach(v=>LN(x0,sy(v),x1,sy(v),C.grid,0.75));
  LN(x0,y1,x1,y1,C.axis,1.1); LN(x0,y0,x0,y1,C.axis,1.1);
  xticks.forEach(v=>{ LN(sx(v),y1,sx(v),y1+0.07,C.axis,1.0);
    T([{text:xfmt(v),options:{fontSize:9,color:C.mid}}],sx(v)-0.20,y1+0.11,0.40,0.20,{align:'center'}); });
  yticks.forEach(v=>{ LN(x0-0.07,sy(v),x0,sy(v),C.axis,1.0);
    T([{text:yfmt(v),options:{fontSize:9,color:C.mid}}],x0-0.68,sy(v)-0.10,0.58,0.20,{align:'right'}); });
  // the box is widened into the gutter so the longest of the three x-titles
  // ("...nearest-neighbour scale (°C)") sets on one line rather than wrapping
  T([{text:xlab,options:{fontSize:10,color:C.ink}}],x0-0.30,y1+0.40,PW+0.60,0.22,{align:'center'});
  // rotate about the box centre: place the centre at x0-0.98 so it clears the tick numbers
  T([{text:ylab,options:{fontSize:10,color:C.ink}}],(x0-0.98)-PH/2,(y0+PH/2)-0.11,PH,0.22,{align:'center',rotate:270});
  return {sx,sy,x0,y0,x1,y1};
}
function curve(g,f,lo,hi,col,wpt,dash){
  const N=110; let px=null,py=null,pIn=false;
  for(let k=0;k<=N;k++){ const v=lo+(hi-lo)*k/N, X=g.sx(v), Y=g.sy(f(v));
    const inside = Y>=g.y0-0.01 && Y<=g.y1+0.01;
    if(px!==null && inside && pIn) LN(px,py,X,Y,col,wpt,dash);
    px=X; py=Y; pIn=inside; }
}
const gauss=(a,mu,sg)=>v=>a*Math.exp(-0.5*Math.pow((v-mu)/sg,2));
const swatch=(x,y,col,dash)=>LN(x,y,x+0.30,y,col,dash==='dot'?1.2:2.1,dash==='dash'?'dash':(dash==='dot'?'sysDot':undefined));
const head=(i,letter,title)=>{ T([{text:letter,options:{fontSize:15,bold:true}}],PX[i]-1.00,0.86,0.30,0.26);
  T([{text:title,options:{fontSize:11.5,bold:true}}],PX[i]-0.58,0.88,PW+0.62,0.24); };
// one legend row: optional line swatch, then text; rows are pitched RS apart so none can wrap into the next
const row=(i,k,text,col,dash,full)=>{ const y=SB+k*RS;
  if(col) swatch(PX[i]+0.02,y+0.08,col,dash);
  T([{text,options:{fontSize:9,color:C.ink}}],PX[i]+(col?0.40:0.02),y,PW-(col?0.40:0.02),0.20); };

// ══ A ════════════════════════════════════════════════════════════════════════
{
  const xd=[14,58], yd=[0,1.05];
  const g=axes(0,xd,yd,'PBS melting temperature, Wallace scale (°C)','Editing efficiency (normalised)',
    [20,30,40,50],[0,0.25,0.50,0.75,1.00],v=>String(v),v=>v.toFixed(2));
  s.addShape(pres.ShapeType.rect,{x:g.sx(D.A.lo),y:g.y0,w:g.sx(D.A.hi)-g.sx(D.A.lo),h:PH,
    fill:{color:C.band,transparency:50},line:{type:'none'}});
  D.A.pts.forEach(([x,y])=>{ if(x>=xd[0]&&x<=xd[1]) DOT(g.sx(x),g.sy(y),0.072,C.blue); });
  curve(g,gauss(D.A.lin.a,D.A.lin.mu,D.A.lin.sig),xd[0],xd[1],C.green,1.9,'dash');
  curve(g,gauss(D.A.a,D.A.mu,D.A.sig),xd[0],xd[1],C.verm,2.1);
  LN(g.sx(30),g.y0,g.sx(30),g.y1,C.green,1.0,'sysDot');
  head(0,'A','Wallace scale, as published');
  row(0,0,`this work — peak ${D.A.mu.toFixed(1)} °C, \u03c3 ${D.A.sig.toFixed(1)} °C`,C.verm);
  row(0,1,`Lin et al. 2021 — ${D.A.lin.mu} °C, \u03c3 ${D.A.lin.sig} °C`,C.green,'dash');
  row(0,2,'published 30 °C optimum',C.green,'dot');
  T([{text:`Shaded band, 95% CI for our peak (${D.A.lo.toFixed(1)}\u2013${D.A.hi.toFixed(1)} °C). R² ${D.A.r2.toFixed(2)} vs ${D.A.lin.r2.toFixed(2)}.`,
     options:{fontSize:9,color:C.mid}}],PX[0]+0.02,SB+3*RS,PW,0.40,{lineSpacing:11});
}
// ══ B ════════════════════════════════════════════════════════════════════════
{
  const xd=[-22,52], yd=[0,1.05];
  const g=axes(1,xd,yd,'PBS melting temperature, nearest-neighbour scale (°C)','Editing efficiency (normalised)',
    [-20,-10,0,10,20,30,40,50],[0,0.25,0.50,0.75,1.00],v=>String(v),v=>v.toFixed(2));
  s.addShape(pres.ShapeType.rect,{x:g.sx(D.B.peak[0]),y:g.y0,w:g.sx(D.B.peak[1])-g.sx(D.B.peak[0]),h:PH,
    fill:{color:C.greenband,transparency:40},line:{type:'none'}});
  D.B.pts.forEach(([x,y])=>{ if(x>=xd[0]&&x<=xd[1]) DOT(g.sx(x),g.sy(y),0.072,C.blue); });
  let prev=null;
  D.B.bins.forEach(([cx,m,se])=>{ if(cx<xd[0]||cx>xd[1]) return;
    const X=g.sx(cx),Y=g.sy(m), hi=g.sy(Math.min(1.05,m+se)), lo=g.sy(Math.max(0,m-se));
    LN(X,lo,X,hi,C.verm,1.5); LN(X-0.05,hi,X+0.05,hi,C.verm,1.5); LN(X-0.05,lo,X+0.05,lo,C.verm,1.5);
    if(prev) LN(prev[0],prev[1],X,Y,C.verm,1.8); prev=[X,Y]; });
  D.B.bins.forEach(([cx,m])=>{ if(cx>=xd[0]&&cx<=xd[1])
    s.addShape(pres.ShapeType.ellipse,{x:g.sx(cx)-0.055,y:g.sy(m)-0.055,w:0.11,h:0.11,
      fill:{color:C.verm},line:{color:'FFFFFF',width:0.8}}); });
  head(1,'B','Nearest-neighbour scale, used here');
  row(1,0,'binned means ± SEM (6 °C bins)',C.verm);
  s.addShape(pres.ShapeType.rect,{x:PX[1]+0.02,y:SB+RS+0.03,w:0.30,h:0.13,fill:{color:C.greenband},line:{color:C.green,width:0.6}});
  T([{text:`peak bin, ${D.B.peak[0].toFixed(0)}\u2013${D.B.peak[1].toFixed(0)} °C`,options:{fontSize:9}}],PX[1]+0.40,SB+RS,PW-0.40,0.20);
  T([{text:`best PBS per target, median ${D.bestPerTarget.medianNN.toFixed(1)} °C (n = ${D.bestPerTarget.nTargets})`,options:{fontSize:9}}],PX[1]+0.40,SB+2*RS,PW-0.40,0.20);
  T([{text:'No curve is fitted: the Wallace-to-nearest-neighbour transform is non-linear.',
     options:{fontSize:9,color:C.mid,italic:true}}],PX[1]+0.02,SB+3*RS,PW,0.40,{lineSpacing:11});
}
// ══ C ════════════════════════════════════════════════════════════════════════
{
  const xd=[14,58], yd=[-24,54];
  const g=axes(2,xd,yd,'Wallace melting temperature (°C)','Nearest-neighbour melting temperature (°C)',
    [20,30,40,50],[-20,-10,0,10,20,30,40,50],v=>String(v),v=>String(v));
  curve(g,v=>v,xd[0],xd[1],C.soft,1.3,'dash');
  D.C.pts.forEach(([x,y])=>{ if(x>=xd[0]&&x<=xd[1]&&y>=yd[0]&&y<=yd[1]) DOT(g.sx(x),g.sy(y),0.072,C.orange,35); });
  curve(g,v=>D.C.intercept+D.C.slope*v,xd[0],xd[1],C.verm,2.1);
  head(2,'C','The two scales are not interchangeable');
  row(2,0,`fit:  NN = ${D.C.intercept<0?'\u2212':''}${Math.abs(D.C.intercept).toFixed(1)} + ${D.C.slope.toFixed(2)} × Wallace`,C.verm);
  row(2,1,'identity line (a constant offset)',C.soft,'dash');
  row(2,2,`r = ${D.C.r.toFixed(2)} · R² = ${(D.C.r*D.C.r).toFixed(2)} · n = ${D.n}`);
  T([{text:'A slope of 1.72, not 1, is why one scale cannot be substituted for the other.',
     options:{fontSize:9,color:C.mid}}],PX[2]+0.02,SB+3*RS,PW,0.40,{lineSpacing:11});
}
// ── titles ───────────────────────────────────────────────────────────────────
T([{text:'Figure 4.  ',options:{fontSize:13.5,bold:true}},
   {text:'The plant primer-binding-site melting-temperature optimum depends on the thermodynamic model',options:{fontSize:13.5}}],
  0.55,0.24,12.4,0.28);
T([{text:`${D.n} of 73 analysed primer-binding-site variants, at ${D.targets} of 14 rice target sites (Lin et al. 2021, Figure 1b); efficiency is normalised within each target to that target's maximum.`,
   options:{fontSize:9.5,color:C.mid}}],0.55,0.57,12.4,0.22);
T([{text:'Plant Prime Editor v1.0 · build 96e270bb · every element is a native, editable PowerPoint object',
   options:{fontSize:8,color:'AAAAAA'}}],0.55,7.20,12.4,0.18);
s.addNotes('Figure 4A-C. A: Wallace scale, Gaussian fit (this work, solid orange) against the fit published by Lin et al. 2021 (dashed green); shaded band, 95% CI for the fitted centre; dotted line, published 30 C optimum. B: same measurements, nearest-neighbour scale; no curve fitted; orange, binned means with SEM; shaded band, peak bin 14-20 C. C: the two scales against one another, least-squares fit and identity line.');
/* ── layout audit ────────────────────────────────────────────────────────── */
const AW={' ':0.278,'.':0.278,',':0.278,'\u00b7':0.333,'/':0.278,'(':0.333,')':0.333,'-':0.333,"'":0.191,
  '\u2013':0.556,'\u2014':1.000,'\u2212':0.584,'+':0.584,'\u00d7':0.584,'\u00b2':0.333,
  '\u0394':0.667,'\u00b0':0.400,':':0.278,'\u2032':0.191,'\u2019':0.191,'=':0.584,'%':0.889};
function adv(ch){
  if(AW[ch]!==undefined) return AW[ch];
  if(ch>='0'&&ch<='9') return 0.556;
  if(ch>='a'&&ch<='z') return 'ijl'.includes(ch)?0.222:'ft'.includes(ch)?0.278:'mw'.includes(ch)?0.836:0.556;
  if(ch>='A'&&ch<='Z') return 'IJ'.includes(ch)?0.290:'MW'.includes(ch)?0.870:0.690;
  return 0.620;
}
const widthIn=(t,pt,bold)=>[...t].reduce((a,c)=>a+adv(c),0)*(bold?1.05:1)*pt/72;
let bad=0;
for(let a=0;a<BOXES.length;a++) for(let b=a+1;b<BOXES.length;b++){
  const p=BOXES[a],q=BOXES[b];
  const ox=Math.min(p.x+p.w,q.x+q.w)-Math.max(p.x,q.x);
  const oy=Math.min(p.y+p.h,q.y+q.h)-Math.max(p.y,q.y);
  if(ox>0.004&&oy>0.004){bad++;
    console.log(`OVERLAP  "${p.txt.slice(0,30)}" x "${q.txt.slice(0,30)}"  ${ox.toFixed(3)}x${oy.toFixed(3)}`);}
}
BOXES.forEach(p=>{
  if(p.x<0.02||p.x+p.w>13.31||p.y<0.02||p.y+p.h>7.48){bad++;
    console.log(`OFF-SLIDE "${p.txt.slice(0,40)}"  x ${p.x.toFixed(2)}..${(p.x+p.w).toFixed(2)}  y ${p.y.toFixed(2)}..${(p.y+p.h).toFixed(2)}`);}
  const run=p.rot?p.h:p.w;                     // a rotated box's text runs along its height
  const lines=Math.max(1,Math.floor((p.rot?p.w:p.h)/(p.pt*1.18/72)));
  const t=p.txt.split('\n')[0];
  const need=widthIn(t,p.pt,p.bold);
  const allowed=run*(lines===1?1:lines*0.93);
  if(need>allowed+0.004){bad++;
    console.log(`OVERFLOW "${t.slice(0,46)}"  needs ${need.toFixed(2)}, box ${run.toFixed(2)} x ${lines} line(s)`);}
});
console.log(bad===0?`layout audit: ${BOXES.length} text boxes, no overlaps, no overflow, nothing off-slide`
                   :`layout audit: ${bad} problem(s)`);

pres.writeFile({fileName:'Figure4_ABC_editable.pptx'}).then(f=>console.log('written',f));
