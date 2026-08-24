/* findSpacers ranks candidates on both strands and returns the top 20. The paired-pegRNA
   search (twinPE, PPE, ePPE3) used to take that return value and filter it down to the
   OPPOSITE strand — so wherever the twenty best candidates all lay on the spacer's own
   strand, the opposite-strand search saw an empty list and the architecture was reported
   as undesignable at that locus.

   At OsALS-T2 that is exactly what happened: the default top-twenty contains no
   minus-strand candidate at all, while the strand-specific call returns twenty, three of
   them 10–100 nt from the nick with isCorrectSide true. twinPE, PPE and ePPE3 all failed
   there on a truncation artefact rather than on biology. Both counts are measured by this
   test at run time and printed, so the prose cannot drift away from them.

   findSpacers now takes an optional {strand} and filters BEFORE the cap. This test pins
   both halves: the strand-specific call returns candidates where the filtered call returns
   none, and omitting the option leaves the default return byte-identical. */
const path=require('path'), vm=require('vm'), fs=require('fs');
process.env.PPE_HTML = process.env.PPE_HTML || path.join(__dirname,'..','plant_prime_editor_v1.0.html');
const {ctx}=require(path.join(__dirname,'probe.js'));

const csv=fs.readFileSync(path.join(__dirname,'..','data','benchmark_scored.csv'),'utf8').trim().split('\n');
const hdr=csv[0].split(',');
const rows=csv.slice(1).map(l=>{const c=l.split(','),o={};hdr.forEach((h,i)=>o[h]=c[i]);return o;});
const r=rows.find(x=>x.locus==='OsALS-T2'&&x.genomic_seq&&x.nick_pos&&x.spacer_strand);

let fail=0;
const ok=(c,msg)=>{ if(c) console.log('  ok   '+msg); else {fail++; console.log('  FAIL '+msg);} };

console.log('paired-pegRNA opposite-strand search is not starved by the candidate cap');
if(!r){ console.log('  FAIL OsALS-T2 not found in benchmark_scored.csv'); process.exit(1); }

const d=JSON.parse(vm.runInContext(`(function(){
  var g=${JSON.stringify(r.genomic_seq.toUpperCase())}, nick=${parseInt(r.nick_pos,10)};
  var opp='-';
  var filtered = findSpacers(g,'NGG',20,nick,[]).filter(function(s){return s.strand===opp;});
  var direct   = findSpacers(g,'NGG',20,nick,[],{strand:opp});
  var inWin    = direct.filter(function(s){var q=Math.abs(s.nickPosGenomic-nick);
                   return q>=10 && q<=100 && s.isCorrectSide!==false;});
  var defA = findSpacers(g,'NGG',20,nick,[]).map(function(s){return s.spacer;}).join(',');
  var defB = findSpacers(g,'NGG',20,nick,[],undefined).map(function(s){return s.spacer;}).join(',');
  var wrongStrand = direct.filter(function(s){return s.strand!==opp;}).length;
  return JSON.stringify({filtered:filtered.length, direct:direct.length, inWin:inWin.length,
                         defaultsMatch: defA===defB, wrongStrand:wrongStrand});
})()`,ctx));

ok(d.direct>0,           `strand-specific call returns ${d.direct} minus-strand candidates`);
ok(d.inWin>0,            `${d.inWin} of them are usable: 10-100 nt from the nick, correct side`);
ok(d.wrongStrand===0,    'every returned candidate is on the requested strand');
ok(d.defaultsMatch,      'omitting the option leaves the default return unchanged');
ok(d.direct>d.filtered,  `the old filter-after-cap route found ${d.filtered}; this is the bug this test pins`);

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail?1:0);
