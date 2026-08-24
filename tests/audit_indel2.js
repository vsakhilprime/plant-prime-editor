const {ctx}=require('./probe.js'); const vm=require('vm');
const run=(e,a)=>{ctx.__a=a;return vm.runInContext(e,ctx,{timeout:20000});};
const RC=s=>s.split('').reverse().map(c=>({A:'T',T:'A',G:'C',C:'G'}[c]||'N')).join('');
let P=0,F=0; const ck=(n,c,d)=>{c?P++:F++;console.log((c?'  PASS  ':'* FAIL *')+' '+n.padEnd(46)+(d||''));};
const L='ATGCCTGACTTAGGCACCTGTTAACGGATCCAGTTACCGGATCAGGTACCTTGAGCACTTTGGACCATGGCTAGCTTGACCTAAGGCTTCAGGATCCGTTAACCGGTTAAGCCTTAGGCA';
const seq=L+L+L;
function design(editPos,edits,st){
  const cands=run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)',{s:seq,e:editPos,ed:edits});
  const c=cands.filter(x=>x.strand===st&&x.isCorrectSide)[0]; if(!c)return null;
  const pbs=run('genPBS(__a.s,__a.n,__a.st,8,15,__a.sp)',{s:seq,n:c.nickPosGenomic,st:c.strand,sp:c.spacer});
  const rt=run('genRT(__a.s,__a.n,__a.ed,__a.st,10,40,__a.sp,__a.p)',{s:seq,n:c.nickPosGenomic,ed:edits,st:c.strand,sp:c.spacer,p:pbs[0].seq});
  return {c,pbs:pbs[0],rt:rt[0]};
}
// The flap, expressed in + strand orientation, must equal the WT window with the edit applied.
function check(label,editPos,edits,st,applyToWindow){
  const r=design(editPos,edits,st);
  if(!r){ck(label+' design returned',false);return;}
  const n=r.c.nickPosGenomic, Lr=r.rt.seq.length;
  const plusFlap = st==='+' ? RC(r.rt.seq) : r.rt.seq;      // both expressed 5'->3' on + strand
  // WT window that the flap replaces, in + strand coords
  let wtStart, wtLen;
  if(st==='+'){ wtStart=n; } else { wtStart=n-Lr+1; }
  // length of the WT window differs from flap length by the net indel size
  const net = edits.reduce((s,e)=> e.type==='INS'||e._isInsertion ? s+(e.alt||'').length
                                 : e.alt==='-'? s-1 : s, 0);
  wtLen = Lr - net;
  if(st==='-') wtStart = n - wtLen + 1;
  const wt = seq.slice(wtStart, wtStart+wtLen);
  const expected = applyToWindow(wt, wtStart);
  console.log(`  ${label}: RT ${r.rt.seq} (${Lr})  window ${wtStart}..${wtStart+wtLen-1}`);
  ck(label+' flap == WT window with edit applied', plusFlap===expected,
     plusFlap===expected?'':`\n         got      ${plusFlap}\n         expected ${expected}`);
}
console.log('=== 3 nt INSERTION (CTT after position 150) ===');
for(const st of ['+','-'])
  check('INS '+st, 150, [{genomicPos:150,type:'INS',ref:'',alt:'CTT',_isInsertion:true}], st,
        // tool convention: insert BEFORE the given position (genRT: "splice the insert string BEFORE the target position")
        (wt,start)=>{const i=150-start; return wt.slice(0,i)+'CTT'+wt.slice(i);});
console.log('\n=== 3 nt DELETION (positions 150-152) ===');
for(const st of ['+','-'])
  check('DEL '+st, 150, [0,1,2].map(k=>({genomicPos:150+k,type:'DEL',ref:seq[150+k],alt:'-',_multiDelGroup:0})), st,
        (wt,start)=>{const i=150-start; return wt.slice(0,i)+wt.slice(i+3);});
console.log(`\n${P} passed, ${F} failed`);
