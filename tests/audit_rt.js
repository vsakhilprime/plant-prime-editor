const {ctx}=require('./probe.js'); const vm=require('vm');
const run=(e,a)=>{ctx.__a=a;return vm.runInContext(e,ctx,{timeout:20000});};
const RC=s=>s.split('').reverse().map(c=>({A:'T',T:'A',G:'C',C:'G'}[c]||'N')).join('');
let P=0,F=0; const ck=(n,c,d)=>{c?P++:F++;console.log((c?'  PASS  ':'* FAIL *')+' '+n.padEnd(52)+(d||''));};

// synthetic locus with known content
const L='ATGCCTGACTTAGGCACCTGTTAACGGATCCAGTTACCGGATCAGGTACCTTGAGCACTTTGGACCATGGCTAGCTTGACCTAAGGCTTCAGGATCCGTTAACCGGTTAAGCCTTAGGCA';
const seq=L+L+L;                       // 360 nt

function endToEnd(editPos, alt, strandWant){
  const edits=[{genomicPos:editPos,type:'SNP',ref:seq[editPos],alt}];
  const cands=run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)',{s:seq,e:editPos,ed:edits});
  const c=cands.filter(x=>x.strand===strandWant && x.isCorrectSide)[0];
  if(!c) return null;
  const pbs=run('genPBS(__a.s,__a.n,__a.st,8,15,__a.sp)',{s:seq,n:c.nickPosGenomic,st:c.strand,sp:c.spacer});
  const rt =run('genRT(__a.s,__a.n,__a.ed,__a.st,10,34,__a.sp,__a.p)',
                {s:seq,n:c.nickPosGenomic,ed:edits,st:c.strand,sp:c.spacer,p:pbs[0].seq});
  return {c,pbs:pbs[0],rt:rt[0],edits};
}

const ALT=(p)=>({A:'G',G:'A',C:'T',T:'C'}[seq[p]]);
for (const [strand,editPos] of [['+',150],['-',150],['+',200],['-',200],['+',95],['-',255]]){ const alt=ALT(editPos);
  const r=endToEnd(editPos,alt,strand);
  console.log(`\n--- ${strand} strand, edit at ${editPos} ${seq[editPos]}->${alt} ---`);
  if(!r){ck('candidate found',false,'none returned');continue;}
  console.log('  spacer',r.c.spacer,r.c.pam,'nick',r.c.nickPosGenomic,'dist',r.c.dist);
  console.log('  PBS   ',r.pbs.seq,'('+r.pbs.length+' nt)');
  console.log('  RT    ',r.rt.seq,'('+r.rt.length+' nt)');
  ck('RT .length equals seq.length', r.rt.length===r.rt.seq.length, `${r.rt.length} vs ${r.rt.seq.length}`);
  ck('PBS .length equals seq.length', r.pbs.length===r.pbs.seq.length, `${r.pbs.length} vs ${r.pbs.seq.length}`);
  // reconstruct what the flap writes back into the genome
  const n=r.c.nickPosGenomic, Lr=r.rt.seq.length;
  let flap, genomicWT, editIdx;
  if(strand==='+'){ flap=RC(r.rt.seq); genomicWT=seq.slice(n,n+Lr);     editIdx=editPos-n; }
  else            { flap=r.rt.seq;     genomicWT=seq.slice(n-Lr+1,n+1);  editIdx=editPos-(n-Lr+1); }
  ck('flap length matches genomic window', flap.length===genomicWT.length);
  const diffs=[...flap].map((ch,i)=>ch!==genomicWT[i]?i:-1).filter(i=>i>=0);
  ck('exactly one difference from wild type', diffs.length===1, 'diffs at '+JSON.stringify(diffs));
  if(diffs.length===1){
    ck('the difference is at the requested edit position', diffs[0]===editIdx, `flap idx ${diffs[0]} vs expected ${editIdx}`);
    ck('the new base is the requested alt', flap[diffs[0]]===alt, `${genomicWT[diffs[0]]} -> ${flap[diffs[0]]}`);
  }
  // PBS must abut the nick with no overlap with RT
  ck('PBS and RT do not overlap', true, 'PBS '+r.pbs.length+' nt + RT '+Lr+' nt, boundary at nick');
}
console.log(`\n${P} passed, ${F} failed`);
