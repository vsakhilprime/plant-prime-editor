const vm=require('vm'), fs=require('fs'), path=require('path');
process.env.PPE_HTML = process.env.PPE_HTML || process.argv[2] || path.join(__dirname,'..','plant_prime_editor_v1.0.html');
const {ctx}=require('./lib/load_tool.js');
const q=(e)=>vm.runInContext(e,ctx,{timeout:20000});

// capture downloads instead of writing them
const captured=[];
ctx.Blob = class { constructor(parts,opts){ this.parts=parts; this.type=opts&&opts.type; } };
ctx.URL  = { createObjectURL:(b)=>{ captured.push({type:b.type, body:b.parts.join('')}); return 'blob:x'; },
             revokeObjectURL(){} };
ctx.btoa = s=>Buffer.from(s,'binary').toString('base64');
ctx.unescape = s=>s;
ctx.XMLSerializer = class { serializeToString(n){ return n.__xml || '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><text>x</text></svg>'; } };

// build a real design to export
const seq=fs.readFileSync(require('path').resolve(__dirname,'..','data','sequences_plain','OsALS-T2.txt'),'utf8').trim();
ctx.__seq=seq;
q(`
  var _e=[{genomicPos:300,type:'SNP',ref:'G',alt:'T'}];
  var _sp=findSpacers(__seq,'NGG',20,300,_e);
  var _pb=genPBS(__seq,_sp[3].nickPosGenomic,_sp[3].strand,5,17,_sp[3].spacer);
  var _rt=genRT(__seq,_sp[3].nickPosGenomic,_e,_sp[3].strand,8,40,_sp[3].spacer,_pb[0].seq);
  designResult = { spacers:_sp, pbsCandidates:_pb, rtCandidates:_rt, nickSgRNAs:[],
                   genomicSeq:__seq, genomicEditPos:300, allEdits:_e, geneLength:__seq.length,
                   target:{seq_name:'OsALS'} };
  window.designResult = designResult;
  window._lastResult = { nt_variants:[{position:302,ref:'G',var:'C',type:'SNP',seq_name:'Ref1'},
                                      {position:303,ref:'A',var:'C',type:'SNP',seq_name:'Ref1'}],
                         summary:{n_nt_variants:2} };
  window._handoffMeta = { organism:'Oryza sativa', accession:'LOC_Os02g30630', name:'OsALS', source:'RAP-DB', note:'' };
  'built ' + _sp.length + ' spacers, ' + _pb.length + ' PBS, ' + _rt.length + ' RT';
`);
console.log('design:', q("'built '+designResult.spacers.length+' spacers, '+designResult.pbsCandidates.length+' PBS, '+designResult.rtCandidates.length+' RT'"));

// 1. collector
const d=q('JSON.parse(JSON.stringify(collectAllResults()))');
console.log('\ncollectAllResults():');
console.log('  tool               ', d.tool);
console.log('  m1 variants        ', d.module1.variants_detected.length);
console.log('  spacers captured   ', d.module2.spacers_all.length);
console.log('  PBS captured       ', d.module2.pbs_all.length);
console.log('  RT captured        ', d.module2.rt_all.length);
console.log('  organism           ', d.genomic.organism);
console.log('  assembled pegRNA   ', d.assembled_pegRNA ? d.assembled_pegRNA.total_nt+' nt' : '(not assembled)');
const sc=Object.keys(d.module2.spacers_all[0]);
console.log('  spacer fields kept ', sc.length, '->', sc.slice(0,12).join(','));

// FIX EXPORTS-ASSERT-NOTHING (23 Aug 2026). Everything below used to be console.log
// with no pass/fail anywhere: a builder that threw printed "*** THREW" and continued,
// and an unbalanced document printed "table tags balanced: false" as a statement of
// fact. The runner's regex covered ONE of the five paths this script exercises, so all
// three export builders could break and the suite stayed green. It now counts.
let P = 0, F = 0;
const ck = (n, c, d) => { c ? P++ : F++;
  console.log((c ? '  PASS  ' : '* FAIL *') + ' ' + String(n).padEnd(52) + (d || '')); };

// 2. each exporter
for (const fn of ['downloadAllResultsJSON','downloadAllResultsCSV','downloadAllResultsReport']) {
  captured.length=0;
  try { q(fn+'()'); console.log(`\n${fn}: OK  -> ${captured[0].type}, ${captured[0].body.length.toLocaleString()} chars`); }
  catch(e){ ck(fn + ' runs without throwing', false, e.message); continue; }
  ck(fn + ' runs and produces output', captured.length > 0 && captured[0].body.length > 0,
     captured.length ? captured[0].body.length + ' chars' : 'nothing captured');
  const b=captured[0].body;
  if(fn.endsWith('JSON')){
    let j=null, err=null;
    try { j=JSON.parse(b); } catch(e){ err=e.message; }
    ck('  JSON export parses', j !== null, err || 'top keys: ' + Object.keys(j).join(', '));
    ck('  JSON export carries the build stamp', !!(j && j.build && j.build.design_parameter_fingerprint),
       j && j.build ? j.build.design_parameter_fingerprint : 'absent');
  }
  if(fn.endsWith('CSV')){
    const secs=b.split('\n').filter(l=>l.startsWith('# ')).map(l=>l.slice(2));
    secs.forEach(s=>console.log('     -',s));
    ck('  CSV export is sectioned', secs.length >= 8, secs.length + ' sections');
    ck('  CSV export carries candidate rows', b.split('\n').length > 40,
       b.split('\n').length + ' lines');
  }
  if(fn.endsWith('Report')){
    const unbal=(b.match(/<table>/g)||[]).length-(b.match(/<\/table>/g)||[]).length;
    ck('  report contains tables', /<table>/.test(b), (b.match(/<h2>/g)||[]).length + ' h2 sections');
    ck('  report table tags are balanced', unbal===0, unbal ? unbal + ' unclosed' : 'balanced');
    ck('  report embeds the assembled pegRNA',
       b.includes(d.assembled_pegRNA ? d.assembled_pegRNA.full_sequence.slice(0,30) : 'zzz'),
       d.assembled_pegRNA ? d.assembled_pegRNA.total_nt + ' nt' : '(not assembled)');
  }
}

// 3. diagram download
ctx.document.getElementById=(id)=> id==='ppe-pegrna-diagram'
  ? { querySelector:()=>({ cloneNode:()=>({ setAttribute(){}, getAttribute:(a)=>a==='width'?'900':a==='height'?'300':null,
        insertBefore(){}, firstChild:null, __xml:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"/>' }) }) }
  : null;
captured.length=0;
try { q("downloadPegRNADiagram('svg')"); console.log('\ndownloadPegRNADiagram("svg"): OK ->', captured[0].type, captured[0].body.length,'chars');
      console.log('   starts with XML decl:', captured[0].body.startsWith('<?xml')); }
catch(e){ console.log('\ndownloadPegRNADiagram("svg"): *** THREW:', e.message); }

console.log('\n' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
