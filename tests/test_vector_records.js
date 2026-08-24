// Fifteen vector records, roughly thirty fields each: enzyme names, recognition sites,
// four-base overhangs, Addgene numbers, DOIs, PE-system lists. Nothing in the interface
// cross-checks them against each other, so a field can contradict its neighbour for months.
// This asserts the invariants that must hold between them.
const path=require('path');
const {q}=require(path.join(__dirname,'probe.js'));
const V=q('JSON.parse(JSON.stringify(VECTORS))');
const rc=s=>s.split('').reverse().map(c=>({A:'T',T:'A',G:'C',C:'G'}[c]||c)).join('');
const RECOG={BsaI:'GGTCTC',BsmBI:'CGTCTC',Esp3I:'CGTCTC',BbsI:'GAAGAC'};
let issues=[];
const flag=(id,what)=>issues.push(id+': '+what);
console.log('vectors: '+V.length+'\n');
console.log('id'.padEnd(24)+'plant'.padEnd(9)+'enz'.padEnd(8)+'recog'.padEnd(8)+'oh5'.padEnd(7)+'oh3'.padEnd(7)+'addgene'.padEnd(9)+'verif');
V.forEach(v=>{
  console.log(String(v.id).padEnd(24)+String(v.plant).padEnd(9)+String(v.enzyme).padEnd(8)+
    String(v.enzyme_recog||'-').padEnd(8)+String(v.overhang_5||'-').padEnd(7)+String(v.overhang_3||'-').padEnd(7)+
    String(v.addgene||'-').padEnd(9)+String(v.cloning_verified));
  // 1 enzyme name must have a known recognition site
  const key=Object.keys(RECOG).find(k=>String(v.enzyme||'').toLowerCase().includes(k.toLowerCase()));
  if(!key) flag(v.id,'enzyme "'+v.enzyme+'" is not one of BsaI/BsmBI/Esp3I/BbsI');
  else if(v.enzyme_recog && v.enzyme_recog!==RECOG[key]) flag(v.id,'enzyme_recog '+v.enzyme_recog+' does not match '+v.enzyme+' ('+RECOG[key]+')');
  // 2 overhangs must be 4 nt ACGT
  ['overhang_5','overhang_3','nick_overhang_5'].forEach(k=>{
    if(v[k]!=null && !/^[ACGT]{4}$/.test(v[k])) flag(v.id,k+' = "'+v[k]+'" is not four ACGT bases');
  });
  // 3 addgene id plausible
  if(v.addgene!=null && !/^\d{4,6}$/.test(String(v.addgene))) flag(v.id,'addgene "'+v.addgene+'" is not a plausible id');
  // 4 peSystems non-empty and known
  const KNOWN=['PE2','PE2max','PE3','PE3b','PE4','PE5','PE5b','twinPE','ePPE','PPE','ePPE3'];
  (v.peSystems||[]).forEach(p=>{ if(!KNOWN.includes(p)) flag(v.id,'unknown PE system "'+p+'"'); });
  if(!(v.peSystems||[]).length) flag(v.id,'no peSystems');
  // 5 PE3-family listed but no nick overhang or nick cassette
  const needsNick=(v.peSystems||[]).some(p=>['PE3','PE3b','PE5','PE5b'].includes(p));
  if(needsNick && !v.nick_cassette && !v.nick_overhang_5 && !v.nick_vector) flag(v.id,'offers PE3-family but has no nick_cassette, nick_overhang_5 or nick_vector');
  // 6 doi shape
  if(v.doi && !/^10\.\d{4,9}\//.test(v.doi)) flag(v.id,'doi "'+v.doi+'" is malformed');
  // 7 acceptor coherence
  if(v.acceptor_verified){
    if(!v.acceptor_slot1) flag(v.id,'acceptor_verified but no acceptor_slot1');
    if(v.acceptor_topology==='two_slot' && !v.acceptor_slot2) flag(v.id,'two_slot but no acceptor_slot2');
    const all=[].concat(v.acceptor_slot1||[],v.acceptor_slot2||[]);
    if(new Set(all).size!==all.length) flag(v.id,'acceptor overhangs are not all distinct: '+all.join(','));
    all.forEach(o=>{ if(!/^[ACGT]{4}$/.test(o)) flag(v.id,'acceptor overhang "'+o+'" malformed'); });
    // enzyme named in acceptor must be known
    [v.acceptor_enzyme,v.acceptor_enzyme2].filter(Boolean).forEach(e=>{
      if(!Object.keys(RECOG).some(k=>e.toLowerCase().includes(k.toLowerCase()))) flag(v.id,'acceptor enzyme "'+e+'" unknown');
    });
  }
  // 8 golden_gate_not_published must carry a preferred_strategy
  if(v.golden_gate_not_published && !v.preferred_strategy) flag(v.id,'golden_gate_not_published but no preferred_strategy');
  // 9 required text fields present
  ['name','paper','cloning_method','organisms','pegRNA_promoter','selection'].forEach(k=>{
    if(!v[k]) flag(v.id,'missing '+k);
  });
});
// 10 duplicate ids / addgene numbers
const ids=V.map(v=>v.id); ids.forEach((x,i)=>{ if(ids.indexOf(x)!==i) flag(x,'duplicate id'); });
const ag=V.filter(v=>v.addgene).map(v=>v.addgene+'');
ag.forEach((x,i)=>{ if(ag.indexOf(x)!==i) flag(x,'Addgene #'+x+' used by more than one vector'); });
console.log('\n'+(V.length*9-issues.length)+' checks passed, '+issues.length+' failed');
issues.forEach(s=>console.log('  * '+s));
if(issues.length) process.exit(1);
