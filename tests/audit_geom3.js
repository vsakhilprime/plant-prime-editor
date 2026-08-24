const {ctx}=require('./probe.js'); const vm=require('vm'); const fs=require('fs');
const run=(e,a)=>{ctx.__a=a;return vm.runInContext(e,ctx,{timeout:20000});};
const RC=s=>s.split('').reverse().map(c=>({A:'T',T:'A',G:'C',C:'G'}[c]||'N')).join('');
function parseCSV(t){const R=[];let r=[],c='',Q=false;for(let i=0;i<t.length;i++){const ch=t[i];
 if(Q){if(ch==='"'&&t[i+1]==='"'){c+='"';i++;}else if(ch==='"')Q=false;else c+=ch;}
 else if(ch==='"')Q=true;else if(ch===','){r.push(c);c='';}else if(ch==='\n'){r.push(c);R.push(r);r=[];c='';}
 else if(ch!=='\r')c+=ch;} if(c.length||r.length){r.push(c);R.push(r);}
 const h=R.shift().map(x=>x.trim());return R.filter(x=>x.some(v=>v.trim())).map(x=>Object.fromEntries(h.map((k,i)=>[k,(x[i]??'').trim()])));}
const rows=parseCSV(fs.readFileSync('./data/targets_verified.csv','utf8'));

// cache the tool's own nick per (gene,spacer)
const nickCache=new Map();
function toolNick(seq,spacer,editPos){
  const k=spacer+'|'+seq.length;
  if(nickCache.has(k)) return nickCache.get(k);
  const cands=run('findSpacers(__a.s,"NGG",20,__a.e,[{genomicPos:__a.e,type:"SNP",ref:__a.s[__a.e],alt:"A"}])',{s:seq,e:editPos});
  const hit=cands.find(c=>c.spacer===spacer);
  const v=hit?{nick:hit.nickPosGenomic,strand:hit.strand}:null;
  nickCache.set(k,v); return v;
}
let tot={'+':0,'-':0}, ok={'+':0,'-':0}, miss=[], nofind=0;
for(const r of rows){
  if(!r.pbs_seq||!/^[ACGT]+$/i.test(r.pbs_seq)) continue;
  if(r.pbs_source && /genome/i.test(r.pbs_source)) continue;
  const seq=(r.genomic_seq||'').toUpperCase().replace(/[^ACGT]/g,'');
  const spc=(r.spacer||'').toUpperCase();
  const L=parseInt(r.pbs_length,10);
  if(!seq||!spc||!Number.isFinite(L)) continue;
  let pos=seq.indexOf(spc), st='+';
  if(pos<0){pos=seq.indexOf(RC(spc)); st='-';}
  if(pos<0) continue;
  const editPos = st==='+' ? Math.min(seq.length-1,pos+22) : Math.max(0,pos-3);
  const t=toolNick(seq,spc,editPos);
  if(!t){nofind++;continue;}
  const c=run('genPBS(__a.s,__a.n,__a.st,__a.L,__a.L,__a.sp,true)',{s:seq,n:t.nick,st:t.strand,L,sp:spc});
  if(!c||!c[0])continue;
  tot[t.strand]++;
  if(c[0].seq===r.pbs_seq.toUpperCase()) ok[t.strand]++;
  else if(miss.length<8) miss.push(`${r.peg_id} (${t.strand},${L}nt) tool ${c[0].seq}  pub ${r.pbs_seq}`);
}
console.log('PBS reproduced from the tool\'s own spacer call, per strand:');
console.log(`  + strand : ${ok['+']} / ${tot['+']}`);
console.log(`  - strand : ${ok['-']} / ${tot['-']}`);
console.log(`  total    : ${ok['+']+ok['-']} / ${tot['+']+tot['-']}`);
if(nofind) console.log(`  (${nofind} rows where findSpacers did not return that spacer for the probe edit)`);
if(miss.length){console.log('  mismatches:'); miss.forEach(m=>console.log('   ',m));}
