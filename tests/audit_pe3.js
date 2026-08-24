const {ctx}=require('./probe.js'); const vm=require('vm');
const run=(e,a)=>{ctx.__a=a;return vm.runInContext(e,ctx,{timeout:20000});};
let P=0,F=0; const ck=(n,c,d)=>{c?P++:F++;console.log((c?'  PASS  ':'* FAIL *')+' '+n.padEnd(56)+(d||''));};
const L='ATGCCTGACTTAGGCACCTGTTAACGGATCCAGTTACCGGATCAGGTACCTTGAGCACTTTGGACCATGGCTAGCTTGACCTAAGGCTTCAGGATCCGTTAACCGGTTAAGCCTTAGGCA';
const seq=L+L+L;
const ALT={A:'G',G:'A',C:'T',T:'C'};
const RC=s=>s.split('').reverse().map(c=>({A:'T',T:'A',G:'C',C:'G'}[c])).join('');
// Is there an NGG PAM on `strand` whose three bases span the edit position? If not,
// PE3b has nothing to work with there and returning no candidates is the correct answer.
function pamCoversEdit(strand){
  for(let i=Math.max(0,150-2);i<=150;i++){
    const w=seq.slice(i,i+3); if(w.length<3) continue;
    const pam = strand==='+' ? w : RC(w);
    if(pam[1]==='G'&&pam[2]==='G') return true;
  }
  return false;
}
for(const pegStrand of ['+','-']){
  const pos=150, edits=[{genomicPos:pos,type:'SNP',ref:seq[pos],alt:ALT[seq[pos]]}];
  const cands=run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)',{s:seq,e:pos,ed:edits});
  const peg=cands.filter(x=>x.strand===pegStrand&&x.isCorrectSide)[0];
  console.log(`\n--- pegRNA on ${pegStrand} strand, nick ${peg.nickPosGenomic} ---`);
  for(const peType of ['PE3','PE3b']){
    const ns=run('genNickSgRNA(__a.s,__a.n,__a.st,__a.ed,"NGG",20,__a.t)',
                 {s:seq,n:peg.nickPosGenomic,st:pegStrand,ed:edits,t:peType});
    console.log(`  ${peType}: ${ns.length} candidate(s)`);
    if(!ns.length){
      // PE3b is conditional by construction: its nicking sgRNA sits on the EDITED
      // strand and the installed edit must destroy that sgRNA's PAM. In this synthetic
      // sequence the edit at index 150 is covered by exactly one NGG PAM anywhere, and
      // that PAM is on the minus strand. So a minus-strand pegRNA has one PE3b partner
      // and a plus-strand pegRNA has none. Zero is correct, and asserting otherwise was
      // the one failing check this suite used to report and then swallow.
      const expected = peType==='PE3b' && !pamCoversEdit(pegStrand);
      ck(`${peType} candidate count is explained`, expected,
         expected ? 'none, and none exists: no '+pegStrand+'-strand PAM covers the edit'
                  : 'NONE RETURNED and a PAM does cover the edit');
      continue;
    }
    const wantStrand = peType==='PE3' ? (pegStrand==='+'?'-':'+') : pegStrand;
    ck(`${peType} all candidates on the ${wantStrand} strand`,
       ns.every(c=>c.strand===wantStrand), 'strands '+[...new Set(ns.map(c=>c.strand))].join(','));
    const top=ns[0];
    console.log(`     top: ${top.spacer} ${top.pam} strand ${top.strand} nick ${top.nickPos??top.nickPosGenomic} dist ${top.dist??top.nickDist??'-'}`);
    if(peType==='PE3'){
      const d=ns.map(c=>Math.abs((c.nickPos??c.nickPosGenomic)-peg.nickPosGenomic));
      ck('PE3 nick-to-nick distances all > 0', d.every(x=>x>0), 'range '+Math.min(...d)+'-'+Math.max(...d));
    }
    if(peType==='PE3b'){
      ck('PE3b: every candidate PAM overlaps an edit', ns.every(c=>c.pamDisrupted!==false),
         'flags '+[...new Set(ns.map(c=>String(c.pamDisrupted)))].join(','));
    }
  }
}
console.log(`\n${P} passed, ${F} failed`);
