/* The Pol III +1 base is promoter-specific: U6 promoters initiate on G, U3 promoters on A
   (Ma X et al. 2016 Mol Plant 9:961 — "definite transcription initiation sites, A nucleotide
   for U3 promoters and G nucleotide for U6 promoters").

   Before this test existed the checklist printed "A-start for the U3 promoter" while its pass
   condition read spacer[0]==='G', so a spacer that was correct for an OsU3 vector was reported
   as failing, and one that was wrong was reported as passing. Four of the fifteen vectors run
   a pegRNA cassette on OsU3, so the mislabel was not a corner case. */
const path=require('path'), vm=require('vm');
process.env.PPE_HTML = process.env.PPE_HTML || path.join(__dirname,'..','plant_prime_editor_v1.0.html');
const {ctx}=require(path.join(__dirname,'probe.js'));

let fail=0;
const check=(id,c1,c2)=>{
  const d=JSON.parse(vm.runInContext(`(function(){selectVector(${JSON.stringify(id)});
    return JSON.stringify({b1:_PPE_POL3_START_1,n1:_PPE_POL3_NAME_1,b2:_PPE_POL3_START_2,n2:_PPE_POL3_NAME_2,
                           p:selectedVec.pegRNA_promoter});})()`,ctx));
  const ok = d.b1===c1 && d.b2===c2;
  if(!ok){fail++;console.log(`  FAIL ${id}: expected ${c1}/${c2}, got ${d.b1}/${d.b2}  [${d.p}]`);}
  else console.log(`  ok   ${id.padEnd(16)} cassette1 ${d.b1} (${d.n1})  cassette2 ${d.b2} (${d.n2})`);
};

console.log('Pol III +1 base follows the vector promoter');
check('pHEE401E','G','G');       // AtU6-26
check('pH-ePPE','G','G');        // OsU6-2
check('ePE2-rice','G','G');      // OsU6-2
check('nCas9-PPE','A','A');      // OsU3
check('pH-nCas9-PPE','A','A');   // OsU3
check('pSpG-PPE','A','A');       // OsU3
check('pPPE-mono','G','A');      // OsU6-2 cassette 1 + OsU3 cassette 2

// the prefix helper must add the promoter's own base, not always G
const pre=JSON.parse(vm.runInContext(`(function(){selectVector('nCas9-PPE');
  return JSON.stringify({u3:_ppePrefix2('TTACGTGCATGCATGCATGC')});})()`,ctx));
if(pre.u3[0]!=='A'){fail++;console.log('  FAIL prefix on a U3 vector added '+pre.u3[0]+', expected A');}
else console.log('  ok   prefix on a U3 vector adds A');


// ── the primer path ───────────────────────────────────────────────────────────
// The checks above only prove the globals are right. What matters is whether the
// base actually reaches the oligonucleotide a user orders, so run a real design on
// a U3 vector and confirm P1 carries A, not G, at the +1 position.
const fs=require('fs');
function readCsv(p){const t=fs.readFileSync(p,'utf8').replace(/^\ufeff/,'').trim().split(/\r?\n/);
  const sp=l=>{const o=[];let c='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];
  if(ch==='"'){if(q&&l[i+1]==='"'){c+='"';i++;}else q=!q;}else if(ch===','&&!q){o.push(c);c='';}else c+=ch;}o.push(c);return o;};
  const h=sp(t[0]);return t.slice(1).map(l=>{const c=sp(l),o={};h.forEach((k,i)=>o[k]=c[i]);return o;});}
const bench=readCsv(path.join(__dirname,'..','data','benchmark_scored.csv'));
const loci={}; bench.forEach(r=>{if(r.genomic_seq&&r.published_spacer&&r.spacer_strand&&r.nick_pos&&!loci[r.locus])loci[r.locus]=r;});
const L=loci['OsALS-T2'];

function primerFirstBase(vecId){
  return JSON.parse(vm.runInContext(`(function(){
    selectVector(${JSON.stringify(vecId)}); selectedCloningStrategy='gg';
    var g=${JSON.stringify(L.genomic_seq.toUpperCase())};
    var nick=${parseInt(L.nick_pos,10)}, strand=${JSON.stringify(L.spacer_strand)};
    var spacer=${JSON.stringify(L.published_spacer)};
    var editPos=nick+5, from=g.charAt(editPos), to=(from==='A'?'T':'A');
    var pbsC=genPBS(g,nick,strand,8,15,spacer,false);
    var rtC=genRT(g,nick,[{pos:editPos,type:'SNP',from:from,to:to}],strand,10,34,spacer,pbsC[0].seq);
    rtC=rtC.slice().sort(function(a,b){return b.score-a.score;});
    var ns={spacer:g.slice(nick+40,nick+60),strand:strand==='+'?'-':'+'};
    m2Data={peSystem:'PE2',spacer:{spacer:spacer},rt:{seq:rtC[0].seq},pbs:{seq:pbsC[0].seq},
            selectedNick:ns,nickSgRNAs:[ns],twinSpacer:{spacer:g.slice(nick+30,nick+50)},
            twinPBS:[{seq:pbsC[0].seq}],twinRT:[{seq:rtC[0].seq}],locus:'OsALS-T2'};
    window._m3EditableSeqs=null; allPrimers.length=0; runPrimerDesign();
    var p1=allPrimers.filter(function(p){return (p.name||'').indexOf('P1')===0;})[0];
    var i=(p1.seq||'').toUpperCase().indexOf(spacer);
    return JSON.stringify({base: i>0 ? p1.seq.toUpperCase()[i-1] : null, spacerStarts: spacer[0]});
  })()`,ctx));
}
const u6=primerFirstBase('pH-ePPE');      // OsU6-2 -> expect G
const u3=primerFirstBase('pH-nCas9-PPE'); // OsU3   -> expect A
if(u6.base!=='G'){fail++;console.log('  FAIL P1 on a U6 vector carries '+u6.base+', expected G');}
else console.log('  ok   P1 on a U6 vector carries G at the +1 position');
if(u3.base!=='A'){fail++;console.log('  FAIL P1 on a U3 vector carries '+u3.base+', expected A');}
else console.log('  ok   P1 on a U3 vector carries A at the +1 position');

console.log(fail? `\n${fail} FAILED` : '\nAll Pol III start-base checks pass.');
process.exit(fail?1:0);
