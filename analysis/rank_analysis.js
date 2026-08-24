process.env.PPE_HTML = process.env.PPE_HTML || (__dirname + '/../plant_prime_editor_v1.0.html');
const {ctx}=require('../tests/lib/load_tool.js'); const vm=require('vm'); const fs=require('fs');
const run=(e,a)=>{ctx.__a=a;return vm.runInContext(e,ctx,{timeout:20000});};
const edits=JSON.parse(fs.readFileSync(__dirname+'/../data/edits.json','utf8'));
const comp=JSON.parse(fs.readFileSync(__dirname+'/../data/competitors.json','utf8'));
const f=(v,w)=>String(v===null||v===undefined?'—':v).padEnd(w);
console.log('WHERE DOES THE PUBLISHED, EXPERIMENTALLY VALIDATED SPACER RANK?');
console.log(f('target',12)+f('our #1',22)+f('our top no-warning',22)+f('published rank',16)+f('cands',7)+'pegF offers / PE-D offers');
const rows=[];
for(const d of edits){
  const seq=fs.readFileSync(__dirname+'/../data/sequences_plain/'+d.t+'.txt','utf8').trim();
  const ed=[{genomicPos:d.lo,type:d.kind==='substitution'?'SNP':d.kind.toUpperCase(),
             ref:d.plus,alt:(d.act.match(/to ([ACGT]+)/)||[])[1]||'A'}];
  const c=run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)',{s:seq,e:d.lo,ed});
  const top=c[0], clean=c.find(x=>!x.warnings||x.warnings.length===0);
  const pubIdx=c.findIndex(x=>x.spacer===d.spacer);
  const pf=comp.find(x=>x.target===d.t&&x.tool==='pegFinder');
  const pd=comp.find(x=>x.target===d.t&&x.tool==='PE-Designer');
  rows.push({t:d.t, n:c.length, pubRank:pubIdx+1, pubPct: pubIdx>=0? (1-pubIdx/c.length)*100 : null,
    top:top.spacer, topScore:top.score, clean:clean&&clean.spacer,
    pfN:pf?pf.n_spacers:null, pdN:pd?pd.n_spacers:null,
    pfHasPub: pf? pf.spacer===d.spacer : null, pdHasPub: pd? pd.spacer===d.spacer : null});
  console.log(f(d.t,12)+f(top.spacer,22)+f(clean&&clean.spacer,22)+
    f(pubIdx>=0? `${pubIdx+1} of ${c.length}`:'not found',16)+f(c.length,7)+
    `${pf?pf.n_spacers:'-'} / ${pd?pd.n_spacers:'-'}`);
}
const found=rows.filter(r=>r.pubRank>0);
console.log(`\npublished spacer present in our candidate list: ${found.length} of ${rows.length}`);
console.log(`  median rank ${found.map(r=>r.pubRank).sort((a,b)=>a-b)[Math.floor(found.length/2)]}`+
            `  median percentile ${(found.map(r=>r.pubPct).sort((a,b)=>a-b)[Math.floor(found.length/2)]).toFixed(0)}`);
console.log(`  our #1 IS the published spacer: ${rows.filter(r=>r.top===edits.find(e=>e.t===r.t).spacer).length} of ${rows.length}`);
console.log(`  pegFinder's pick is the published spacer: ${rows.filter(r=>r.pfHasPub).length} of ${rows.length}`);
console.log(`  PE-Designer's first row is the published spacer: ${rows.filter(r=>r.pdHasPub).length} of ${rows.length}`);
console.log(`\ncandidates offered:  ours median ${rows.map(r=>r.n).sort((a,b)=>a-b)[3]},  pegFinder median ${rows.map(r=>r.pfN).sort((a,b)=>a-b)[3]},  PE-Designer median ${rows.map(r=>r.pdN).sort((a,b)=>a-b)[3]}`);
// script-relative like every read above; as a bare '../data/...' this wrote
// wherever it happened to be invoked from, leaving a second, diverging copy
fs.writeFileSync(__dirname+'/../data/rank_analysis.json',JSON.stringify(rows,null,1));
