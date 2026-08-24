process.env.PPE_HTML = process.env.PPE_HTML || (__dirname + '/../plant_prime_editor_v1.0.html');
const {ctx}=require('../tests/lib/load_tool.js'); const vm=require('vm'); const fs=require('fs');
const run=(e,a)=>{ctx.__a=a;return vm.runInContext(e,ctx,{timeout:20000});};
const RC=s=>s.split('').reverse().map(c=>({A:'T',T:'A',G:'C',C:'G'}[c]||'N')).join('');
const comp=JSON.parse(fs.readFileSync(__dirname+'/../data/competitors.json','utf8'));
const edits=JSON.parse(fs.readFileSync(__dirname+'/../data/edits.json','utf8'));
const E={}; edits.forEach(d=>E[d.t]=d);
const SEQ={}; edits.forEach(d=>SEQ[d.t]=fs.readFileSync(
  __dirname+'/../data/sequences_plain/'+d.t+'.txt','utf8').trim());
const wallace=s=>4*((s.match(/[GC]/g)||[]).length)+2*((s.match(/[AT]/g)||[]).length);
const tmNN=s=>run('m2_calcTm(__a.s)',{s});

// PBS at a given length for a spacer located in the window
function pbsFor(seq, spacer, len){
  let p=seq.indexOf(spacer), st='+';
  if(p<0){ p=seq.indexOf(RC(spacer)); st='-'; }
  if(p<0) return null;
  const nick = st==='+' ? p+spacer.length-3 : p+2;      // tool's own convention
  const c=run('genPBS(__a.s,__a.n,__a.st,__a.L,__a.L,__a.sp)',{s:seq,n:nick,st,L:len,sp:spacer});
  return c && c[0] ? {seq:c[0].seq, tm:c[0].tm, wtm:c[0].wtm, gc:c[0].gc_pct, strand:st} : null;
}

const OUT=[];
for (const d of edits){
  const t=d.t, seq=SEQ[t];
  const editPos0 = d.kind==='insertion' ? d.lo : d.lo;
  const ed=[{genomicPos:editPos0,type:d.kind==='substitution'?'SNP':d.kind.toUpperCase(),
             ref:d.plus, alt:(d.act.match(/to ([ACGT]+)/)||[])[1]||'A'}];
  const cands=run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)',{s:seq,e:editPos0,ed});
  const ours=cands.find(c=>!c.warnings||c.warnings.length===0) || cands[0];
  const ourPBS=run('genPBS(__a.s,__a.n,__a.st,5,17,__a.sp)',
                   {s:seq,n:ours.nickPosGenomic,st:ours.strand,sp:ours.spacer})[0];
  const pf=comp.find(c=>c.target===t&&c.tool==='pegFinder');
  const pd=comp.find(c=>c.target===t&&c.tool==='PE-Designer');
  const pfPBS = pf ? pbsFor(seq, pf.spacer, parseInt(pf.pbs_len)) : null;
  const pdPBS = pd ? pbsFor(seq, pd.spacer, parseInt(pd.pbs_len)) : null;
  OUT.push({target:t,
    n_candidates: cands.length,
    ours:{spacer:ours.spacer, rank:cands.indexOf(ours)+1, score:ours.score,
          pbs_len:ourPBS.length, pbs:ourPBS.seq, tm_nn:ourPBS.tm, tm_wal:ourPBS.wtm},
    pegfinder: pf ? {spacer:pf.spacer, pbs_len:+pf.pbs_len,
          pbs:pfPBS&&pfPBS.seq, tm_nn:pfPBS&&pfPBS.tm, tm_wal:pfPBS&&pfPBS.wtm,
          same_spacer_as_ours: pf.spacer===ours.spacer,
          in_our_candidate_list: cands.some(c=>c.spacer===pf.spacer)} : null,
    pedesigner: pd ? {spacer:pd.spacer, pbs_len:+pd.pbs_len,
          pbs:pdPBS&&pdPBS.seq, tm_nn:pdPBS&&pdPBS.tm, tm_wal:pdPBS&&pdPBS.wtm,
          same_spacer_as_ours: pd.spacer===ours.spacer,
          in_our_candidate_list: cands.some(c=>c.spacer===pd.spacer)} : null,
    published_spacer: E[t].spacer,
  });
}
fs.writeFileSync(__dirname+'/../data/headtohead.json', JSON.stringify(OUT,null,1));
const f=(v,w)=>String(v===null||v===undefined?'—':v).padEnd(w);
console.log('SPACER CHOICE');
console.log(f('target',12)+f('published',22)+f('Plant Prime Editor',22)+f('pegFinder',22)+'PE-Designer');
OUT.forEach(o=>console.log(f(o.target,12)+f(o.published_spacer,22)+
  f(o.ours.spacer,22)+f(o.pegfinder&&o.pegfinder.spacer,22)+(o.pedesigner&&o.pedesigner.spacer||'—')));
console.log('\nPBS LENGTH AND MELTING TEMPERATURE  (plant optimum: 14-20 C on the NN scale = ~30 C Wallace)');
console.log(f('target',12)+f('ours nt',9)+f('Tm NN',8)+f('Tm Wal',8)+f('pegF nt',9)+f('Tm NN',8)+f('Tm Wal',8)+f('PE-D nt',9)+f('Tm NN',8)+'Tm Wal');
OUT.forEach(o=>console.log(f(o.target,12)+
  f(o.ours.pbs_len,9)+f(o.ours.tm_nn,8)+f(o.ours.tm_wal,8)+
  f(o.pegfinder&&o.pegfinder.pbs_len,9)+f(o.pegfinder&&o.pegfinder.tm_nn,8)+f(o.pegfinder&&o.pegfinder.tm_wal,8)+
  f(o.pedesigner&&o.pedesigner.pbs_len,9)+f(o.pedesigner&&o.pedesigner.tm_nn,8)+(o.pedesigner&&o.pedesigner.tm_wal||'—')));
