const fs=require('fs'), vm=require('vm');
const HTML=process.argv[2]||require('path').join(__dirname,'..','plant_prime_editor_v1.0.html');
const html=fs.readFileSync(HTML,'utf8');
const blocks=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
console.log('script blocks:',blocks.length,' file bytes',html.length);
let bad=0;
blocks.forEach((m,i)=>{
  const code=m[1];
  const lineNo=html.slice(0,m.index).split('\n').length;
  if(!/[A-Za-z]/.test(code)){console.log(`  #${i} (line ${lineNo}) empty`);return;}
  try{ new vm.Script(code,{filename:`block${i}`}); console.log(`  #${i} (line ${lineNo}) ${code.length} chars  PARSE OK`); }
  catch(e){ bad++; console.log(`  #${i} (line ${lineNo}) ${code.length} chars  *** SYNTAX ERROR: ${e.message}`); }
});
console.log(bad? `\n${bad} BLOCK(S) FAILED TO PARSE` : '\nAll blocks parse.');
// duplicate top-level declarations across blocks
const decl={};
blocks.forEach((m,i)=>{
  for(const mm of m[1].matchAll(/^\s{0,2}(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)){
    (decl[mm[1]]=decl[mm[1]]||[]).push(i);
  }
});
const dups=Object.entries(decl).filter(([k,v])=>new Set(v).size>1 || v.length>1);
console.log('\nsymbols declared more than once at top level:', dups.length);
dups.slice(0,40).forEach(([k,v])=>console.log('  ',k,'in blocks',[...new Set(v)].join(','),`(x${v.length})`));
