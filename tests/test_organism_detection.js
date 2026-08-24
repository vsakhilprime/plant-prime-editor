const vm=require('vm'); const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(process.env.PPE_HTML || process.argv[2] ||
  path.join(__dirname,'..','plant_prime_editor_v1.0.html'),'utf8');
// pull just the extractor out and run it standalone
const i=html.indexOf('const _KNOWN_GENERA');
const j=html.indexOf('// ── Error panel with fallback links');
const code=html.slice(i,j);
const ctx=vm.createContext({}); vm.runInContext(code,ctx);
const f=(h)=>vm.runInContext('_extractOrganism('+JSON.stringify(h)+')',ctx);

const MONO=['rice','oryza','wheat','triticum','maize','zea','barley','hordeum','sorghum',
 'brachypodium','setaria','sugarcane','banana','musa','monocot','lolium','panicum'];
const DICOT=['arabidopsis','tomato','solanum','nicotiana','benthamiana','soybean','glycine',
 'potato','tobacco','lettuce','carrot','cotton','poplar','medicago','cassava','cucumber','melon','dicot'];
const cls=(o)=>{const l=(o||'').toLowerCase();
  return MONO.some(h=>l.includes(h))?'monocot':DICOT.some(h=>l.includes(h))?'dicot':'NOT DETECTED';};

const cases=[
 ['KJ697755.1 Triticum aestivum cultivar Chinese Spring GW2 (GW2) gene, complete cds','monocot','YOUR CASE'],
 ['KF009556.1 Triticum aestivum MLO-B1 (Mlo-B1) gene, complete cds','monocot',''],
 ['KJ000052.1 Triticum aestivum GASR7 gene','monocot',''],
 ['JF683316.1 Triticum aestivum DEMETER-like protein gene','monocot',''],
 ['NM_001060234.1 Oryza sativa Japonica Group Os03g0151800 mRNA','monocot',''],
 ['LOC_Os02g30630 Oryza sativa acetolactate synthase','monocot',''],
 ['Solyc03g044330.2.1 Solanum lycopersicum acetolactate synthase 1','dicot',''],
 ['AT3G48560.1 Arabidopsis thaliana acetolactate synthase','dicot',''],
 ['NC_003076.8 Arabidopsis thaliana chromosome 5','dicot',''],
 ['gi|123|gb|XX000000.1| Zea mays waxy gene','monocot',''],
 ['my_sequence','NOT DETECTED','no species information — must ask'],
 ['','NOT DETECTED','pasted with no header — must ask'],
 ['random header with no organism at all','NOT DETECTED',''],
];
let pass=0,fail=0;
console.log('header                                                              organism found        class        expected');
for(const [h,exp,note] of cases){
  const o=f(h), c=cls(o), ok=c===exp; ok?pass++:fail++;
  console.log((h.slice(0,64)||'(empty)').padEnd(68)+String(o||'—').padEnd(22)+c.padEnd(13)+exp+(ok?'':'   *** FAIL ***')+(note?'   <- '+note:''));
}
console.log(`\n${pass} passed, ${fail} failed`);
